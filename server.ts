import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/export", async (req, res) => {
    const { roomCode, roomTitle, cards, stats } = req.body;

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.replace(/^"|"$/g, '');
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID?.replace(/^"|"$/g, '');

    if (!serviceAccountEmail || !privateKey) {
      console.error("Missing Google Sheets credentials:", { 
        hasEmail: !!serviceAccountEmail, 
        hasKey: !!privateKey 
      });
      return res.status(400).send({ 
        success: false, 
        error: "Google Sheets credentials are not configured in environment variables. Please check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in Settings > Secrets." 
      });
    }

    if (!spreadsheetId) {
      console.error("Missing GOOGLE_SHEET_ID");
      return res.status(400).send({ 
        success: false, 
        error: "GOOGLE_SHEET_ID가 설정되지 않았습니다. 데이터를 저장할 스프레드시트의 ID를 Settings > Secrets에 추가해 주세요." 
      });
    }

    try {
      const serviceAccountAuth = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
      await doc.loadInfo();

      const now = new Date();
      const timestamp = `${now.toLocaleDateString()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
      const title = `${roomTitle} (${roomCode}) - ${timestamp}`;
      
      const newSheet = await doc.addSheet({ 
        title: title.slice(0, 100), 
        headerValues: ['Title', 'Content', 'Author', 'Likes', 'Comments', 'Timestamp'] 
      });

      await newSheet.addRows(cards);

      // Add stats at the bottom
      await newSheet.addRows([
        {}, // Empty row
        { Title: 'SUMMARY STATISTICS' },
        { Title: 'Total Items', Content: stats.totalCards },
        { Title: 'Total Reactions', Content: stats.totalLikes },
        { Title: 'Total Participants', Content: stats.totalParticipants },
        { Title: 'Exported At', Content: new Date().toLocaleString() }
      ]);

      res.json({ 
        success: true, 
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${newSheet.sheetId}` 
      });
    } catch (error: any) {
      console.error("Export error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
