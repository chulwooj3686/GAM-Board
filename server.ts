import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// ✅ Fix 5+6: 비밀번호를 서버 환경변수에서만 읽음 (VITE_ 접두사 없음 → 번들 포함 안됨)
const FACILITATOR_PASSWORD = process.env.FACILITATOR_PASSWORD;

// ── 인증 미들웨어 ────────────────────────────────────────────────
// ✅ Fix 5: /api/export에 토큰 검증 추가
function requireFacilitatorAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['x-facilitator-token'];
  if (!authHeader || authHeader !== FACILITATOR_PASSWORD) {
    return res.status(401).json({ success: false, error: '인증 실패: 퍼실리테이터 토큰이 올바르지 않습니다.' });
  }
  next();
}

// ✅ Fix 6: 퍼실리테이터 비밀번호 서버사이드 검증 엔드포인트
// Onboarding.tsx에서 클라이언트 직접 비교 대신 이 API를 호출
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // 퍼실리테이터 로그인 (비밀번호 서버에서 검증)
  app.post('/api/facilitator-login', (req: Request, res: Response) => {
    const { password } = req.body;
    if (!FACILITATOR_PASSWORD) {
      return res.status(500).json({ success: false, error: '서버에 FACILITATOR_PASSWORD가 설정되지 않았습니다.' });
    }
    if (password !== FACILITATOR_PASSWORD) {
      return res.status(401).json({ success: false, error: '비밀번호가 올바르지 않습니다.' });
    }
    // 성공 시 토큰 반환 (간단히 비밀번호 자체를 Bearer로 사용; 프로덕션에선 JWT 사용 권장)
    return res.json({ success: true, token: FACILITATOR_PASSWORD });
  });

  // Google Sheets 내보내기 (퍼실리테이터 인증 필수)
  app.post('/api/export', requireFacilitatorAuth, async (req: Request, res: Response) => {
    const { roomCode, roomTitle, cards, stats } = req.body;

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.replace(/^"|"$/g, '');
    const privateKey          = process.env.GOOGLE_PRIVATE_KEY?.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    const spreadsheetId       = process.env.GOOGLE_SHEET_ID?.replace(/^"|"$/g, '');

    if (!serviceAccountEmail || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Google Sheets 인증 정보가 환경변수에 설정되어 있지 않습니다.',
      });
    }

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'GOOGLE_SHEET_ID가 설정되지 않았습니다.',
      });
    }

    try {
      const serviceAccountAuth = new JWT({
        email:  serviceAccountEmail,
        key:    privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
      await doc.loadInfo();

      const now = new Date();
      const timestamp = `${now.toLocaleDateString()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
      const title = `${roomTitle} (${roomCode}) - ${timestamp}`.slice(0, 100);

      const newSheet = await doc.addSheet({
        title,
        headerValues: ['Title', 'Content', 'Author', 'Likes', 'Comments', 'Timestamp'],
      });

      await newSheet.addRows(cards);
      await newSheet.addRows([
        {},
        { Title: 'SUMMARY STATISTICS' },
        { Title: 'Total Items',        Content: stats.totalCards },
        { Title: 'Total Reactions',    Content: stats.totalLikes },
        { Title: 'Total Participants', Content: stats.totalParticipants },
        { Title: 'Exported At',        Content: new Date().toLocaleString() },
      ]);

      res.json({
        success: true,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${newSheet.sheetId}`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite / Static
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
