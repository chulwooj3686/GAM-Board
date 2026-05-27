/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, LayoutGrid, Users, Settings, LogOut, Hash, MessageSquare, Edit2, Check, ChevronLeft, X, Image, ChevronDown } from 'lucide-react';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, runTransaction } from 'firebase/firestore';
import { UserRole, Card, Message, Participant, SlidoPoll, QnAQuestion, WordCloudItem } from '../types';
import PostItCard from './PostItCard';
import ChatSidebar from './ChatSidebar';
import { db, auth, OperationType, handleFirestoreError, ensureAuthenticated } from '../lib/firebase';
import { BarChart as BarChartIcon, Download, Shield, TrendingUp, PieChart as PieChartIcon, Activity, Lock, Unlock, Palette, Flag, Pin, Volume2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import axios from 'axios';

interface BoardProps {
  roomCode: string;
  nickname: string;
  role: UserRole;
  onExit: () => void;
}

export const SKINS: Record<string, { name: string, bg: string, text: string, cardBorder: string, desc: string, iconBg: string }> = {
  sand: { name: '크라프트 샌드 🌾', bg: 'bg-[#F9F7F2]', text: 'text-slate-800', cardBorder: 'border-[#E1DFDA]', desc: '아늑하고 따뜻한 크라프트 배경', iconBg: 'bg-[#F9F7F2] border-[#E1DFDA]' },
  chalkboard: { name: '클래식 초록 칠판 🌿', bg: 'bg-[#142C1D]', text: 'text-emerald-50', cardBorder: 'border-[#233C2A]', desc: '분위기 있는 초록색 학교 칠판', iconBg: 'bg-[#142C1D] border-[#233C2A]' },
  lavender: { name: '포근 연보라 🍇', bg: 'bg-[#F3F0FA]', text: 'text-slate-800', cardBorder: 'border-[#DFDCF0]', desc: '편안함을 주는 연보라색 파스텔', iconBg: 'bg-[#F3F0FA] border-[#DFDCF0]' },
  mint: { name: '허브 가든 민트 🍃', bg: 'bg-[#EBF3EC]', text: 'text-slate-800', cardBorder: 'border-[#D9E3DA]', desc: '싱그러운 풀내음의 허브 정원', iconBg: 'bg-[#EBF3EC] border-[#D9E3DA]' },
  sunset: { name: '노을 빛 멜론 🍊', bg: 'bg-[#FCF4F0]', text: 'text-slate-800', cardBorder: 'border-[#F0E6D2]', desc: '노을 빛의 웜톤 레몬 오렌지 배경', iconBg: 'bg-[#FCF4F0] border-[#F0E6D2]' },
  blueprint: { name: '설계 그리드 블루 📐', bg: 'bg-[#1E293B] bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]', text: 'text-slate-100', cardBorder: 'border-slate-800', desc: '아이디어 구상용 블루 그리드 도트', iconBg: 'bg-[#1E293B] border-slate-700' },
  corkboard: { name: '네츄럴 코르크 🪵', bg: 'bg-[#E7D6BE] bg-[radial-gradient(#CBB38E_1px,transparent_1px)] [background-size:12px_12px]', text: 'text-[#4A2D1B]', cardBorder: 'border-[#C1A882]', desc: '전통 나무 질감 자석 코르크보드', iconBg: 'bg-[#E7D6BE] border-[#C1A882]' },
  cyber: { name: '미드나잇 어바웃 🌌', bg: 'bg-[#0F172A] bg-[linear-gradient(to_right,#1E293B_1px,transparent_1px),linear-gradient(to_bottom,#1E293B_1px,transparent_1px)] [background-size:24px_24px]', text: 'text-indigo-100', cardBorder: 'border-slate-800', desc: '미래지향적인 어두운 격자 스킨', iconBg: 'bg-[#0F172A] border-slate-850' },
};

export default function Board({ roomCode, nickname, role, onExit }: BoardProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default to closed on mobile
  const [activeTab, setActiveTab] = useState<'board' | 'slido' | 'chat'>('board');
  const [desktopTab, setDesktopTab] = useState<'board' | 'slido'>('board');
  const [roomSkin, setRoomSkin] = useState<string>('sand');
  const [roomLocked, setRoomLocked] = useState<boolean>(false);
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState<string>('');
  const [isComposerOpen, setIsComposerOpen] = useState(role === 'user');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [participants, setParticipants] = useState<{id: string, name: string}[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardText, setNewCardText] = useState('');
  const [newCardColor, setNewCardColor] = useState<Card['color']>('yellow');
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [roomTitle, setRoomTitle] = useState('Untitled Board');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [printType, setPrintType] = useState<'board' | 'chat' | 'all' | null>(null);


  // Slido Live Database States
  const [polls, setPolls] = useState<SlidoPoll[]>([]);
  const [qnas, setQnAs] = useState<QnAQuestion[]>([]);
  const [wordCloud, setWordCloud] = useState<WordCloudItem[]>([]);
  const [slidoSubTab, setSlidoSubTab] = useState<'poll' | 'wordcloud' | 'qna'>('qna');

  // Slido local form inputs
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState<string[]>(['아주 좋음', '좋음', '보통']);
  const [qnaInput, setQnaInput] = useState('');
  const [wordInput, setWordInput] = useState('');

  const isAdmin = role === 'admin';

  // Statistics Calculation
  const stats = {
    totalCards: cards.length,
    totalLikes: cards.reduce((acc, card) => acc + card.likes, 0),
    totalComments: cards.reduce((acc, card) => acc + (card.comments?.length || 0), 0),
    colorDistribution: [
      { name: 'Yellow', value: cards.filter(c => c.color === 'yellow').length, color: '#FDE047' },
      { name: 'Pink', value: cards.filter(c => c.color === 'pink').length, color: '#f43f5e' },
      { name: 'Purple', value: cards.filter(c => c.color === 'purple').length, color: '#a855f7' },
      { name: 'Cyan', value: cards.filter(c => c.color === 'cyan').length, color: '#0ea5e9' },
      { name: 'Green', value: cards.filter(c => c.color === 'green').length, color: '#22c55e' },
    ].filter(item => item.value > 0),
    userActivity: Object.entries(
      cards.reduce((acc, card) => {
        acc[card.author] = (acc[card.author] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, count]) => ({ name, count: count as number })).sort((a, b) => b.count - a.count).slice(0, 5)
  };

  // Firebase Real-time Sync
  useEffect(() => {
    let unsubscribeCards: (() => void) | undefined;
    let unsubscribeMessages: (() => void) | undefined;
    let unsubscribeParticipants: (() => void) | undefined;
    let unsubscribeRoom: (() => void) | undefined;
    let unsubscribePolls: (() => void) | undefined;
    let unsubscribeQnA: (() => void) | undefined;
    let unsubscribeWordCloud: (() => void) | undefined;
    let heartbeatInterval: number | undefined;
    let isMounted = true;

    const setupSync = async () => {
      try {
        setIsLoading(true);
        const user = await ensureAuthenticated();
        if (!user || !isMounted) {
          setIsLoading(false);
          return;
        }

        // Room Metadata Sync (includes locked, skin, pinnedAnnouncement)
        const roomRef = doc(db, 'rooms', roomCode);
        unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setRoomTitle(data.title || 'Untitled Board');
            setRoomSkin(data.skin || 'sand');
            setRoomLocked(data.locked || false);
            setPinnedAnnouncement(data.pinnedAnnouncement || '');
          } else {
            if (role === 'admin') {
              // Create default room if not exists (fail-safe for admins)
              setDoc(roomRef, { 
                title: 'New GAM Board', 
                skin: 'sand', 
                locked: false, 
                pinnedAnnouncement: '',
                createdAt: serverTimestamp() 
              }, { merge: true });
            } else {
              // For standard users, if the room does not exist, boot them out
              alert('해당 보드가 존재하지 않거나 관리자에 의해 삭제되었습니다.');
              onExit();
            }
          }
        });

        // Presence Heartbeat
        const participantRef = doc(db, 'rooms', roomCode, 'participants', user.uid);
        const updatePresence = async () => {
          if (!isMounted) return;
          try {
            await setDoc(participantRef, {
              id: user.uid,
              name: nickname,
              role: role,
              lastSeen: Date.now()
            });
          } catch (error) {
            console.error('Presence heartbeat error:', error);
          }
        };
        
        await updatePresence();
        heartbeatInterval = window.setInterval(updatePresence, 30000);

        // Subscriptions
        unsubscribeCards = onSnapshot(
          query(collection(db, 'rooms', roomCode, 'cards'), orderBy('timestamp', 'desc')),
          (snapshot) => {
            if (!isMounted) return;
            const fetchedCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Card));
            setCards(fetchedCards);
            setIsLoading(false);
          },
          (error) => {
            if (!isMounted) return;
            setIsLoading(false);
            console.error('Cards sync error:', error);
            handleFirestoreError(error, OperationType.LIST, `rooms/${roomCode}/cards`);
          }
        );

        unsubscribeMessages = onSnapshot(
          query(collection(db, 'rooms', roomCode, 'messages'), orderBy('timestamp', 'asc')),
          (snapshot) => {
            if (!isMounted) return;
            const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(fetchedMessages);
          },
          (error) => {
            if (!isMounted) return;
            console.error('Messages sync error:', error);
            handleFirestoreError(error, OperationType.LIST, `rooms/${roomCode}/messages`);
          }
        );

        unsubscribeParticipants = onSnapshot(
          collection(db, 'rooms', roomCode, 'participants'),
          (snapshot) => {
            if (!isMounted) return;
            const now = Date.now();
            const activeParticipants = snapshot.docs
              .map(doc => {
                const data = doc.data() as Participant;
                return data;
              })
              .filter(p => (now - (p.lastSeen || 0)) < 60000)
              .map(p => ({ id: p.id, name: p.name }));
            setParticipants(activeParticipants);
          },
          (error) => {
            if (!isMounted) return;
            console.error('Participants sync error:', error);
            handleFirestoreError(error, OperationType.LIST, `rooms/${roomCode}/participants`);
          }
        );

        // Slido collection subscribers
        unsubscribePolls = onSnapshot(
          query(collection(db, 'rooms', roomCode, 'polls'), orderBy('timestamp', 'desc')),
          (snapshot) => {
            if (!isMounted) return;
            const fetchedPolls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlidoPoll));
            setPolls(fetchedPolls);
          }
        );

        unsubscribeQnA = onSnapshot(
          query(collection(db, 'rooms', roomCode, 'qna'), orderBy('votes', 'desc')),
          (snapshot) => {
            if (!isMounted) return;
            const fetchedQnA = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QnAQuestion));
            setQnAs(fetchedQnA);
          }
        );

        unsubscribeWordCloud = onSnapshot(
          query(collection(db, 'rooms', roomCode, 'wordcloud'), orderBy('count', 'desc')),
          (snapshot) => {
            if (!isMounted) return;
            const fetchedWords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WordCloudItem));
            setWordCloud(fetchedWords);
          }
        );

      } catch (error) {
        if (isMounted) {
          console.error('Firebase setup failed:', error);
          setIsLoading(false);
        }
      }
    };

    setupSync();

    return () => {
      isMounted = false;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (unsubscribeCards) unsubscribeCards();
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeParticipants) unsubscribeParticipants();
      if (unsubscribeRoom) unsubscribeRoom();
      if (unsubscribePolls) unsubscribePolls();
      if (unsubscribeQnA) unsubscribeQnA();
      if (unsubscribeWordCloud) unsubscribeWordCloud();
      
      // Cleanup presence on exit
      if (auth.currentUser) {
        const participantRef = doc(db, 'rooms', roomCode, 'participants', auth.currentUser.uid);
        deleteDoc(participantRef).catch(() => {}); // Silent catch on cleanup
      }
    };
  }, [roomCode, nickname]);

  const handleDownloadCSV = () => {
    const headers = ['Title', 'Content', 'Author', 'Likes', 'Comments Count', 'Timestamp'];
    const rows = cards.map(c => [
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${c.content.replace(/"/g, '""')}"`,
      `"${c.author.replace(/"/g, '""')}"`,
      c.likes,
      c.comments?.length || 0,
      new Date(c.timestamp).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `board_export_${roomCode}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await axios.post('/api/export', {
        roomCode,
        roomTitle,
        cards: cards.map(c => ({
          title: c.title,
          content: c.content,
          author: c.author,
          likes: c.likes,
          commentsCount: c.comments?.length || 0,
          timestamp: new Date(c.timestamp).toLocaleString()
        })),
        stats: {
          totalCards: stats.totalCards,
          totalLikes: stats.totalLikes,
          totalParticipants: participants.length
        }
      });
      
      if (response.data.success) {
        alert('데이터가 구글 시트로 성공적으로 전송되었습니다!\n시트 URL: ' + response.data.url);
        window.open(response.data.url, '_blank');
      } else {
        throw new Error(response.data.error || 'Export failed');
      }
    } catch (error: any) {
      console.error('Export error:', error);
      let errorMsg = error.message;
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMsg = error.response.data;
        } else if (error.response.data.error) {
          errorMsg = error.response.data.error;
        } else {
          errorMsg = JSON.stringify(error.response.data);
        }
      }
      alert(`내보내기 중 오류가 발생했습니다: ${errorMsg}\n\n[도움말] Settings > Secrets 메뉴에서 다음 항목이 설정되어 있는지 확인하세요:\n1. GOOGLE_SERVICE_ACCOUNT_EMAIL\n2. GOOGLE_PRIVATE_KEY\n3. GOOGLE_SHEET_ID`);
    } finally {
      setIsExporting(false);
    }
  };

  // PDF Export Engine with high fidelity html2pdf support and custom, oklch-safe inline styling
  const exportToPDF = async (type: 'board' | 'chat' | 'all') => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // Load html2pdf dynamically from standard CDN to avoid bundle size issues and compilation bugs
      const html2pdf = await new Promise<any>((resolve, reject) => {
        if ((window as any).html2pdf) {
          resolve((window as any).html2pdf);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.onload = () => resolve((window as any).html2pdf);
        script.onerror = () => reject(new Error('PDF 라이브러리를 로드하지 못했습니다. 인터넷 연결을 확인하세요.'));
        document.head.appendChild(script);
      });

      // Create a temporary layout wrapper and container in the DOM at (0, 0)
      // Visually hidden using an absolute position, low z-index and almost zero opacity
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '0px';
      wrapper.style.top = '0px';
      wrapper.style.width = '780px';
      wrapper.style.zIndex = '-99999';
      wrapper.style.opacity = '0.01';
      wrapper.style.pointerEvents = 'none';

      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.width = '780px';
      container.style.backgroundColor = '#ffffff';
      container.style.color = '#1e293b';
      container.style.padding = '40px';
      container.style.boxSizing = 'border-box';
      container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      container.style.lineHeight = '1.6';

      // 1. Header block
      let htmlContent = `
        <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 32px;">
          <div style="font-size: 11px; color: #4f46e5; font-weight: 850; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">GAM BOARD / FADLET</div>
          <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin: 0 0 12px 0; letter-spacing: -0.02em;">${roomTitle} - 회의록</h1>
          <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; color: #64748b;">
            <div>방 코드: <span style="background-color: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: bold;">${roomCode}</span></div>
            <div>출력 일자: <strong>${new Date().toLocaleString('ko-KR')}</strong></div>
            <div>참여자: <strong>${nickname} (${role === 'admin' ? '퍼실리테이터' : '참여자'})</strong></div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;">
            <div style="font-size: 24px; font-weight: 900; color: #0f172a; margin-bottom: 4px;">${cards.length}</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 700;">등록된 포스트잇</div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;">
            <div style="font-size: 24px; font-weight: 900; color: #0f172a; margin-bottom: 4px;">${stats.totalLikes}</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 700;">누적 추천 수</div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;">
            <div style="font-size: 24px; font-weight: 900; color: #0f172a; margin-bottom: 4px;">${messages.length}</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 700;">채팅 메시지</div>
          </div>
        </div>
      `;

      // 2. Board Cards block
      if (type === 'board' || type === 'all') {
        htmlContent += `
          <div style="margin-bottom: 40px;">
            <h2 style="font-size: 18px; font-weight: 900; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; margin-bottom: 24px;">
              📌 보드 포스트잇 내역 (${cards.length}개)
            </h2>
        `;

        if (cards.length > 0) {
          htmlContent += `<div style="display: flex; flex-direction: column; gap: 24px;">`;
          
          cards.forEach(c => {
            const cardColors = {
              pink: { bg: '#FFF0F5', text: '#86198F', border: '#FBCFE8' },
              purple: { bg: '#F6EBFF', text: '#6B21A8', border: '#E9D5FF' },
              cyan: { bg: '#ECF8FF', text: '#075985', border: '#BAE6FD' },
              green: { bg: '#F0FFF4', text: '#166534', border: '#BBF7D0' },
              yellow: { bg: '#FFFDF0', text: '#854D0E', border: '#FEF08A' },
            };
            const colorInfo = cardColors[c.color] || cardColors.yellow;
            
            htmlContent += `
              <div style="background-color: ${colorInfo.bg}; border-left: 6px solid ${colorInfo.border}; color: ${colorInfo.text}; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); page-break-inside: avoid; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 600; opacity: 0.9; margin-bottom: 12px;">
                  <span style="font-weight: 700; color: #0f172a;">👤 ${c.author || '익명'}</span>
                  <span style="font-family: monospace;">${new Date(c.timestamp).toLocaleString('ko-KR')}</span>
                </div>
                ${c.title ? `<div style="font-size: 15px; font-weight: 800; margin-bottom: 8px; color: #0f172a;">${c.title}</div>` : ''}
                <div style="font-size: 13.5px; white-space: pre-wrap; padding-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,0.05); margin-bottom: 16px; line-height: 1.6; color: #1e293b;">${c.content}</div>
                <div style="display: flex; gap: 16px; font-size: 12px; font-weight: bold; opacity: 0.9;">
                  <span>❤️ 추천 ${c.likes || 0}</span>
                  <span>💬 댓글 ${(c.comments || []).length}</span>
                </div>
            `;

            if (c.comments && c.comments.length > 0) {
              htmlContent += `<div style="margin-top: 16px; background-color: rgba(255, 255, 255, 0.5); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">`;
              c.comments.forEach(comment => {
                htmlContent += `
                  <div style="border-bottom: 1px solid rgba(0,0,0,0.04); padding-bottom: 8px; margin-bottom: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; opacity: 0.8; font-weight: 600; margin-bottom: 2px;">
                      <span style="font-weight: 700; color: #0f172a;">↪ ${comment.author || '익명'}</span>
                      <span>${new Date(comment.timestamp).toLocaleString('ko-KR')}</span>
                    </div>
                    <div style="font-size: 12px; color: #334155;">${comment.text}</div>
                  </div>
                `;
              });
              htmlContent += `</div>`;
            }

            htmlContent += `</div>`;
          });

          htmlContent += `</div>`;
        } else {
          htmlContent += `<p style="color: #94a3b8; font-size: 14px; font-style: italic; padding: 16px 0;">보드판에 등록된 포스트잇이 없습니다.</p>`;
        }
        
        htmlContent += `</div>`;
      }

      // 3. Chat Messages block
      if (type === 'chat' || type === 'all') {
        const topMargin = type === 'all' ? '40px' : '0px';
        htmlContent += `
          <div style="margin-top: ${topMargin};">
            <h2 style="font-size: 18px; font-weight: 900; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; margin-bottom: 24px;">
              💬 실시간 대화방 기록 (${messages.length}개)
            </h2>
        `;

        if (messages.length > 0) {
          htmlContent += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
          
          messages.forEach(m => {
            const isSystem = m.type === 'file' || m.type === 'resource';
            const bg = isSystem ? '#f1f5f9' : '#f8fafc';
            const borderLeftColor = isSystem ? '#64748b' : '#cbd5e1';
            
            htmlContent += `
              <div style="background-color: ${bg}; border-left: 4px solid ${borderLeftColor}; padding: 14px; border-radius: 4px; page-break-inside: avoid; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #64748b; margin-bottom: 6px;">
                  <span style="font-weight: 800; color: #1e293b;">👤 ${m.user || '익명'}</span>
                  <span style="font-family: monospace;">${new Date(m.timestamp).toLocaleString('ko-KR')}</span>
                </div>
                <div style="font-size: 13.5px; color: #334155; white-space: pre-wrap; word-break: break-all; line-height: 1.6;">
                  ${m.text}
                  ${m.fileName ? `
                    <div style="margin-top: 8px; background-color: #ffffff; border: 1px dashed #cbd5e1; padding: 6px 12px; border-radius: 4px; font-size: 11.5px; display: inline-block; font-weight: 700;">
                      📎 첨부파일: <span style="color: #4f46e5;">${m.fileName}</span> (${m.fileSize || '크기 미상'})
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          });

          htmlContent += `</div>`;
        } else {
          htmlContent += `<p style="color: #94a3b8; font-size: 14px; font-style: italic; padding: 16px 0;">나눈 대화 기록이 존재하지 않습니다.</p>`;
        }

        htmlContent += `</div>`;
      }

      container.innerHTML = htmlContent;
      wrapper.appendChild(container);
      document.body.appendChild(wrapper);

      const opt = {
        margin: [15, 15, 15, 15],
        filename: `${roomTitle.replace(/[^a-zA-Z0-9가-힣\s-_]/g, '')}_${type === 'board' ? '보드포스트잇' : type === 'chat' ? '대화기록' : '전체회의록'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css'] }
      };

      // Generate PDF directly from the programmatically generated element
      await html2pdf().set(opt).from(container).save();
      
      // Cleanup the temporary elements immediately
      document.body.removeChild(wrapper);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert(`PDF 저장 오류: ${error.message || error}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F1F5F9] space-y-6">
        <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center shadow-xl mb-4">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-8 h-8 bg-white rounded-lg"
          />
        </div>
        <div className="flex flex-col items-center space-y-2">
          <h2 className="text-xl font-bold text-slate-800">보드에 연결 중...</h2>
          <p className="text-slate-400 text-sm font-medium animate-pulse">잠시만 기다려 주세요</p>
        </div>
        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-full h-full bg-brand-primary"
          />
        </div>
      </div>
    );
  }

  const updateRoomTitle = async (newTitle: string) => {
    try {
      await updateDoc(doc(db, 'rooms', roomCode), { title: newTitle });
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Update title error:', error);
    }
  };

  const handleAddCard = async (e: FormEvent) => {
    e.preventDefault();
    if (newCardText.trim() && auth.currentUser) {
      const cardId = Math.random().toString(36).substring(2, 11);
      const cardPath = `rooms/${roomCode}/cards/${cardId}`;
      try {
        const newCardData: any = {
          id: cardId,
          title: newCardTitle.trim() || '',
          author: nickname,
          authorId: auth.currentUser.uid,
          content: newCardText.trim(),
          color: newCardColor,
          likes: 0,
          comments: [],
          timestamp: Date.now(),
        };
        
        await setDoc(doc(db, 'rooms', roomCode, 'cards', cardId), newCardData);
        setNewCardTitle('');
        setNewCardText('');
        setShowAddCard(false);
        
        // Show success animation
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (error) {
        console.error('Add card error:', error);
        handleFirestoreError(error, OperationType.CREATE, cardPath);
      }
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!window.confirm('이 포스트잇을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomCode, 'cards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `rooms/${roomCode}/cards/${id}`);
    }
  };

  const handleUpdateCard = async (id: string, updates: Partial<Card>) => {
    try {
      await updateDoc(doc(db, 'rooms', roomCode, 'cards', id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomCode}/cards/${id}`);
    }
  };

  const handleLike = async (id: string) => {
    if (!auth.currentUser) return;
    const cardRef = doc(db, 'rooms', roomCode, 'cards', id);
    try {
      await runTransaction(db, async (transaction) => {
        const cardDoc = await transaction.get(cardRef);
        if (!cardDoc.exists()) return;
        const currentLikes = cardDoc.data().likes || 0;
        transaction.update(cardRef, { likes: currentLikes + 1 });
      });
    } catch (error) {
      console.error('Like error:', error);
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomCode}/cards/${id}`);
    }
  };

  const handleAddComment = async (cardId: string, text: string) => {
    if (!auth.currentUser || !text.trim()) return;
    const cardRef = doc(db, 'rooms', roomCode, 'cards', cardId);
    try {
      await runTransaction(db, async (transaction) => {
        const cardDoc = await transaction.get(cardRef);
        if (!cardDoc.exists()) return;
        
        const existingComments = cardDoc.data().comments || [];
        const newComment = {
          id: Math.random().toString(36).substring(2, 11),
          author: nickname,
          authorId: auth.currentUser!.uid,
          text: text.trim(),
          timestamp: Date.now()
        };
        
        transaction.update(cardRef, { 
          comments: [...existingComments, newComment]
        });
      });
    } catch (error) {
      console.error('Add comment error:', error);
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomCode}/cards/${cardId}`);
    }
  };

  const handleSendMessage = async (text: string, type: Message['type'], link?: string, fileName?: string, fileSize?: string) => {
    if (!auth.currentUser || !text.trim()) return;
    const messageId = Math.random().toString(36).substring(2, 11);
    const messagePath = `rooms/${roomCode}/messages/${messageId}`;
    try {
      const messageData: any = {
        id: messageId,
        user: nickname,
        userId: auth.currentUser.uid,
        text: text.trim(),
        type,
        timestamp: Date.now(),
      };

      // Only add optional fields if they are defined to avoid Firestore 'undefined' error
      if (link) messageData.link = link;
      if (fileName) messageData.fileName = fileName;
      if (fileSize) messageData.fileSize = fileSize;

      await setDoc(doc(db, 'rooms', roomCode, 'messages', messageId), messageData);
    } catch (error) {
      console.error('Send message error:', error);
      handleFirestoreError(error, OperationType.CREATE, messagePath);
    }
  };

  // 1. Board state updates (Skins & Lock)
  const handleToggleBoardLock = async () => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'rooms', roomCode), { locked: !roomLocked });
    } catch (error) {
      console.error('Toggle lock error:', error);
    }
  };

  const handleChangeBoardSkin = async (skin: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'rooms', roomCode), { skin });
    } catch (error) {
      console.error('Change skin error:', error);
    }
  };

  const handlePinAnnouncement = async (text: string) => {
    try {
      await updateDoc(doc(db, 'rooms', roomCode), { pinnedAnnouncement: text.trim() });
    } catch (error) {
      console.error('Pin announcement error:', error);
    }
  };

  const handleUnpinAnnouncement = async () => {
    try {
      await updateDoc(doc(db, 'rooms', roomCode), { pinnedAnnouncement: '' });
    } catch (error) {
      console.error('Unpin announcement error:', error);
    }
  };

  // 2. Card reporting (Padlet feature)
  const handleReportCard = async (cardId: string) => {
    if (!auth.currentUser) return;
    const cardRef = doc(db, 'rooms', roomCode, 'cards', cardId);
    const userId = auth.currentUser.uid;
    try {
      await runTransaction(db, async (transaction) => {
        const cardDoc = await transaction.get(cardRef);
        if (!cardDoc.exists()) return;
        const currentReports = cardDoc.data().reportedBy || [];
        const isAlreadyReported = currentReports.includes(userId);
        
        const updatedReports = isAlreadyReported
          ? currentReports.filter((uid: string) => uid !== userId)
          : [...currentReports, userId];
        
        transaction.update(cardRef, { reportedBy: updatedReports });
      });
    } catch (error) {
      console.error('Report card error:', error);
    }
  };

  // 3. Q&A Handlers (Slido)
  const handleAddQnAQuestion = async (text: string) => {
    if (!auth.currentUser || !text.trim()) return;
    const qnaId = Math.random().toString(36).substring(2, 11);
    try {
      await setDoc(doc(db, 'rooms', roomCode, 'qna', qnaId), {
        id: qnaId,
        text: text.trim(),
        author: nickname,
        authorId: auth.currentUser.uid,
        votes: 0,
        votedUsers: [],
        answered: false,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Add QnA Question error:', error);
    }
  };

  const handleUpvoteQnAQuestion = async (qnaId: string) => {
    if (!auth.currentUser) return;
    const qnaRef = doc(db, 'rooms', roomCode, 'qna', qnaId);
    const userId = auth.currentUser.uid;
    try {
      await runTransaction(db, async (transaction) => {
        const qnaDoc = await transaction.get(qnaRef);
        if (!qnaDoc.exists()) return;
        
        const currentVoted = qnaDoc.data().votedUsers || [];
        const hasVoted = currentVoted.includes(userId);
        
        let updatedVoted;
        let diff = 0;
        if (hasVoted) {
          updatedVoted = currentVoted.filter((uid: string) => uid !== userId);
          diff = -1;
        } else {
          updatedVoted = [...currentVoted, userId];
          diff = 1;
        }
        
        transaction.update(qnaRef, {
          votedUsers: updatedVoted,
          votes: (qnaDoc.data().votes || 0) + diff
        });
      });
    } catch (error) {
      console.error('Upvote QnA error:', error);
    }
  };

  const handleToggleQnAAnswered = async (qnaId: string, currentStatus: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'rooms', roomCode, 'qna', qnaId), { answered: !currentStatus });
    } catch (error) {
      console.error('Toggle answered QnA error:', error);
    }
  };

  const handleDeleteQnAQuestion = async (qnaId: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomCode, 'qna', qnaId));
    } catch (error) {
      console.error('Delete QnA error:', error);
    }
  };

  // 4. Poll Handlers (Slido)
  const handleCreatePoll = async (question: string, options: string[]) => {
    if (!isAdmin || !question.trim()) return;
    
    // First, end any active polls
    for (const poll of polls) {
      if (poll.active) {
        await updateDoc(doc(db, 'rooms', roomCode, 'polls', poll.id), { active: false });
      }
    }
    
    const pollId = Math.random().toString(36).substring(2, 11);
    try {
      await setDoc(doc(db, 'rooms', roomCode, 'polls', pollId), {
        id: pollId,
        question: question.trim(),
        options: options.filter(o => o.trim() !== ''),
        votes: {},
        active: true,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Create Poll error:', error);
    }
  };

  const handleVotePoll = async (pollId: string, optionIndex: number) => {
    if (!auth.currentUser) return;
    const pollRef = doc(db, 'rooms', roomCode, 'polls', pollId);
    const userId = auth.currentUser.uid;
    try {
      await runTransaction(db, async (transaction) => {
        const pollDoc = await transaction.get(pollRef);
        if (!pollDoc.exists()) return;
        
        const currentVotes = pollDoc.data().votes || {};
        currentVotes[userId] = String(optionIndex);
        
        transaction.update(pollRef, { votes: currentVotes });
      });
    } catch (error) {
      console.error('Vote Poll error:', error);
    }
  };

  const handleTogglePollActive = async (pollId: string, currentActive: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'rooms', roomCode, 'polls', pollId), { active: !currentActive });
    } catch (error) {
      console.error('Toggle Poll Active error:', error);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomCode, 'polls', pollId));
    } catch (error) {
      console.error('Delete Poll error:', error);
    }
  };

  // 5. Word Cloud Handlers (Slido)
  const handleSubmitWordCloudWord = async (word: string) => {
    if (!auth.currentUser || !word.trim()) return;
    const userId = auth.currentUser.uid;
    const cleanWord = word.trim().toLowerCase();
    
    // Generate a simple deterministic ID
    const wordId = cleanWord.replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '_') || 'word_doc';
    const wordRef = doc(db, 'rooms', roomCode, 'wordcloud', wordId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const wordDoc = await transaction.get(wordRef);
        if (wordDoc.exists()) {
          const submittedBy = wordDoc.data().submittedBy || [];
          if (submittedBy.includes(userId)) {
            throw new Error('You already submitted this word!');
          }
          transaction.update(wordRef, {
            count: (wordDoc.data().count || 0) + 1,
            submittedBy: [...submittedBy, userId]
          });
        } else {
          transaction.set(wordRef, {
            id: wordId,
            text: word.trim(), // Keep original casing visual
            count: 1,
            submittedBy: [userId]
          });
        }
      });
    } catch (error: any) {
      console.log('Word Cloud submission notice:', error.message);
      if (error.message && error.message.includes('already submitted')) {
        alert('이미 같은 단어를 입력하셨습니다! 단어구름에는 중복 투표를 할 수 없습니다.');
      }
    }
  };

  const activeSkin = SKINS[roomSkin] || SKINS.sand;

  return (
    <>
      {/* Main Board UI wrapper */}
      <div className={`print-hidden-wrapper flex flex-col h-screen ${activeSkin.bg} overflow-hidden ${activeSkin.text} font-sans transition-colors duration-300 print:hidden`}>
      {/* 1. Header (Top Bar) */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-50 shadow-sm shrink-0 text-slate-800">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-black text-white text-md shadow-sm">GAM</div>
            <h1 className="text-lg font-black tracking-tight text-slate-800 flex items-center gap-2">
              GAM BOARD
              <span className="text-slate-400 font-mono text-xs px-2 py-0.5 bg-slate-100 rounded">코드 {roomCode}</span>
            </h1>
          </div>
          <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
          <h2 className="text-slate-500 font-bold text-sm tracking-tight hidden sm:block">{roomTitle}</h2>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-slate-400 font-bold text-[13px]">
            <div className="flex items-center gap-1.5 hover:text-slate-600 transition-colors cursor-default">
              <Users size={16} />
              <span>{participants.length}명 대화중</span>
            </div>
            
            {/* Status indicators */}
            {roomLocked ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 text-[11px] font-black rounded-full border border-red-100 shadow-sm">
                <Lock size={12} className="text-red-500" />
                <span>보드 잠금됨</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 text-[11px] font-black rounded-full border border-green-100 shadow-sm">
                <Unlock size={12} className="text-green-500" />
                <span>쓰기 활성</span>
              </div>
            )}
          </div>
          
          <div className="h-4 w-[1px] bg-slate-200" />
          
          <div className="flex items-center gap-3">
            {/* 내보내기 Dropdown Button */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="text-xs font-black bg-white border border-slate-200 hover:border-slate-300 text-slate-750 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                <Download size={14} className="text-slate-500" />
                <span>내보내기</span>
                <ChevronDown size={11} className="text-slate-400" />
              </button>
              
              {showExportDropdown && (
                <>
                  <div className="fixed inset-0 z-50 cursor-default" onClick={() => setShowExportDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-150 rounded-xl shadow-xl py-1 z-[60] text-left shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        exportToPDF('board');
                        setShowExportDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                    >
                      보드 PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportToPDF('chat');
                        setShowExportDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                    >
                      채팅 기록 PDF
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        exportToPDF('all');
                        setShowExportDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-100 text-indigo-600 text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
                    >
                      보드 + 채팅 통합
                    </button>
                  </div>
                </>
              )}
            </div>

            {isAdmin && (
              <button 
                type="button"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`p-2 rounded-lg transition-all ${showAdminPanel ? 'bg-slate-800 text-white shadow-xl scale-105' : 'text-slate-400 hover:bg-slate-100'}`}
                title="퍼실리테이터 컨트롤 타워"
              >
                <Settings size={18} />
              </button>
            )}
            <button 
              type="button"
              onClick={onExit} 
              className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
              title="나가기"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation for Mobile Screen (Improved responsiveness to include Slido / Board / Chat seamlessly) */}
      <div className="lg:hidden flex border-b border-slate-200 bg-white z-50 text-slate-800">
        <button 
          onClick={() => setActiveTab('board')}
          type="button"
          className={`flex-1 py-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'board' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-400'}`}
        >
          <LayoutGrid size={15} /> 보드판
        </button>
        <button 
          onClick={() => setActiveTab('slido')}
          type="button"
          className={`flex-1 py-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'slido' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-400'}`}
        >
          <TrendingUp size={15} /> 라이브 소통
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          type="button"
          className={`flex-1 py-3 text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'chat' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-400'}`}
        >
          <MessageSquare size={15} /> 대화방
          {messages.length > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
        </button>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Side (Board grid OR Silido workspace based on tabs selector) */}
        <div className={`flex-1 flex flex-col min-w-0 bg-transparent ${activeTab !== 'chat' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* Facilitator Command Desk - Command Tower */}
          <AnimatePresence>
            {isAdmin && showAdminPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white border-b border-slate-200 overflow-hidden shrink-0 text-slate-800 shadow-md"
              >
                <div className="p-5 max-w-7xl mx-auto space-y-6">
                   <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-150 pb-3">
                      <h3 className="font-black text-slate-800 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                        <Shield size={16} className="text-indigo-600" />
                        퍼실리테이터 컨트롤 타워 (Facilitator Console)
                      </h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleToggleBoardLock}
                          className={`text-xs font-black px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${roomLocked ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'}`}
                        >
                          {roomLocked ? <Lock size={12} /> : <Unlock size={12} />}
                          <span>{roomLocked ? '쓰기 잠금 해제' : '전원 쓰기 잠금'}</span>
                        </button>
                        <button onClick={handleDownloadCSV} className="text-xs font-black bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                          <Download size={12} /> CSV 다운로드
                        </button>
                        <button onClick={handleExport} className="text-xs font-black bg-blue-50 border border-blue-105 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                          <Download size={12} /> 구글 시트전송
                        </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                      {/* Left Block: Skin presets chooser (8 types) */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Palette size={13} className="text-indigo-500" /> 보드판 테마 스킨 변경 (8가지 스킨 제공)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(SKINS).map(([key, value]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleChangeBoardSkin(key)}
                              className={`p-2 rounded-xl text-left border flex flex-col justify-between transition-all hover:border-slate-400 ${
                                roomSkin === key ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-sm' : 'border-slate-200'
                              }`}
                            >
                              <span className="text-xs font-black truncate">{value.name}</span>
                              <div className={`w-full h-3 rounded mt-1.5 ${value.bg}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Right Block: Instant Slido Live Poll manager */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <BarChartIcon size={13} className="text-[#6366F1]" /> 실시간 라이브 투표(Poll) 개설 및 발송
                        </span>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (newPollQuestion.trim()) {
                              handleCreatePoll(newPollQuestion, newPollOptions);
                              setNewPollQuestion('');
                              alert('새로운 현장 투표가 실시간 발송되었습니다! 소통 탭에서 확인하세요.');
                            }
                          }}
                          className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2"
                        >
                          <input 
                            type="text"
                            placeholder="선석에서 물어볼 질문을 입력하세요..."
                            value={newPollQuestion}
                            onChange={(e) => setNewPollQuestion(e.target.value)}
                            className="w-full bg-white border-slate-200 focus:border-indigo-505 focus:ring-1 focus:ring-indigo-505 rounded px-2.5 py-1.5 text-xs font-bold"
                          />
                          <div className="flex items-center justify-between text-[11px] text-slate-450 font-bold">
                            <span>* 세가지 기본옵션제공 (아주 좋음 / 좋음 / 보통)</span>
                            <button
                              type="submit"
                              className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1 rounded font-black text-xs active:scale-95 transition-transform"
                            >
                              투표 전송
                            </button>
                          </div>
                        </form>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

                    {/* Desktop tab toggler (Switch between Board and Slido seamlessly) */}
          <div className="hidden lg:flex px-6 py-3 border-b border-slate-200/40 bg-white/70 backdrop-blur-md items-center justify-between shrink-0 text-slate-855">
             <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
                <button 
                  onClick={() => setDesktopTab('board')}
                  type="button"
                  className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${desktopTab === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <LayoutGrid size={13} className="text-blue-500" /> 
                  <span>📌 포스트잇 게시판</span>
                </button>
                <button 
                  onClick={() => setDesktopTab('slido')}
                  type="button"
                  className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${desktopTab === 'slido' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <TrendingUp size={13} className="text-indigo-500" /> 
                  <span>📊 실시간 라이브 소통 (Slido)</span>
                </button>
             </div>
             
             <div className="text-[11px] text-slate-400 font-bold">
                {activeSkin.desc}
             </div>
          </div>

          {/* Render Condition 1: 포스트잇 게시판 View */}
          {((activeTab === 'board' && !window.matchMedia('(min-width: 1024px)').matches) || (desktopTab === 'board' && window.matchMedia('(min-width: 1024px)').matches)) ? (
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              
              {/* Write Lock warning overlay for participants */}
              {roomLocked && !isAdmin && (
                <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-900 flex items-center gap-2 text-xs font-bold shrink-0">
                  <Lock size={14} className="text-amber-600 animate-bounce" />
                  <span>퍼실리테이터가 현재 보드를 잠갔습니다. 쓰기 및 수정 권한이 제한됩니다.</span>
                </div>
              )}

              {/* 2. Top Navigation & Action Header */}
              <div className="px-6 py-4 flex items-center justify-between shrink-0 max-w-6xl w-full mx-auto gap-4 select-none">
                <div className="flex items-center gap-4">
                  <span className="text-[#64748B] font-bold text-sm sm:text-base tracking-tight">
                    {cards.length}개의 포스트
                  </span>
                  
                  {/* Slim Integrated Search Field */}
                  <div className="relative hidden md:block w-52">
                    <Hash size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="제목, 본문, 작성자 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white/50 hover:bg-white/95 border border-slate-200 rounded-xl pl-8 pr-3 py-1 text-xs font-semibold text-slate-650 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Compact Mobile Search Field */}
                  <div className="relative md:hidden w-36">
                    <Hash size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white/50 border border-slate-200 rounded-lg pl-6 pr-2 py-0.5 text-[11px] font-semibold text-slate-650 focus:outline-none"
                    />
                  </div>

                  {(!roomLocked || isAdmin) && (
                    <button
                      onClick={() => setShowAddCard(true)}
                      type="button"
                      className="bg-[#6366F1] hover:bg-[#5046E5] text-white px-4 py-2 font-black text-xs sm:text-sm rounded-xl flex items-center gap-1 shadow-sm hover:shadow transition-all active:scale-95 shrink-0"
                    >
                      <Plus size={14} className="stroke-[3px]" />
                      <span>새 포스트</span>
                    </button>
                  )}
                  
                  <div className="hidden sm:flex items-center gap-1 text-slate-400 font-bold text-[11px] shrink-0">
                     <Users size={12} />
                     <span>접속 {participants.length}명</span>
                  </div>
                </div>
              </div>

              {/* 3. New Post Composition Modal */}
              <AnimatePresence>
                {showAddCard && (
                  <div 
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-sm" 
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setShowAddCard(false);
                      }
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col p-6 sm:p-7 space-y-5"
                    >
                      {/* Modal Header */}
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2 pb-3">
                        <span className="text-lg font-black text-slate-800 leading-none">
                          새 포스트 작성
                        </span>
                        <button 
                          onClick={() => setShowAddCard(false)}
                          className="p-1 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition-colors"
                          type="button"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Input Frame */}
                      <form onSubmit={handleAddCard} className="space-y-4">
                        <div className="rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 transition-all overflow-hidden bg-white">
                          <textarea 
                            placeholder="내용을 입력하세요..."
                            value={newCardText}
                            onChange={(e) => setNewCardText(e.target.value)}
                            className="w-full min-h-[180px] sm:min-h-[220px] p-4 text-sm sm:text-base font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none bg-transparent leading-relaxed"
                            autoFocus
                          />
                        </div>

                        {/* Color Selector & Visual Frame Attachment Element */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {(['yellow', 'pink', 'purple', 'cyan', 'green'] as Card['color'][]).map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setNewCardColor(color)}
                                className={`w-8 h-8 rounded-full border transition-all ${
                                  newCardColor === color 
                                    ? 'ring-[3px] ring-indigo-500 scale-105 border-transparent' 
                                    : 'border-slate-200 hover:border-slate-350 hover:scale-105'
                                } ${
                                  color === 'yellow' ? 'bg-[#FFF2AD]' : color === 'pink' ? 'bg-[#FFD1DC]' : color === 'purple' ? 'bg-[#E0BBE4]' : color === 'cyan' ? 'bg-[#B2E2F2]' : 'bg-[#C1E1C1]'
                                }`}
                              />
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Decorative file upload icon as in reference screenshot */}
                            <button 
                              type="button"
                              className="p-1 text-slate-300 hover:text-slate-450 transition-colors"
                              title="이미지 첨부 (데코레이션 전용)"
                              onClick={() => alert('포스트잇 텍스트 본문 작성을 완수해주세요.')}
                            >
                              <Image size={20} />
                            </button>
                            <span className="text-[11px] font-bold text-slate-400">{newCardText.length}자</span>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
                          <button 
                            type="submit"
                            disabled={!newCardText.trim()}
                            className="w-full py-3 bg-[#9C9DED] hover:bg-[#8384E3] disabled:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 text-white font-black text-sm sm:text-base rounded-xl transition-all shadow-md active:scale-[0.98]"
                          >
                            포스트 추가
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* 4. Board Content Area (Grid area enlarged and optimized for reading) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
                 <div className="columns-1 sm:columns-2 xl:columns-3 2xl:columns-4 gap-6 space-y-6 max-w-[1600px] mx-auto">
                    <AnimatePresence mode="popLayout">
                       {cards
                        .filter(c => (c.content + (c.title || '') + c.author).toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((card) => (
                          <motion.div 
                            key={card.id} 
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                            className="break-inside-avoid"
                          >
                            <PostItCard 
                              card={card} 
                              currentUserId={auth.currentUser?.uid || ''}
                              isAdmin={isAdmin}
                              onLike={handleLike} 
                              onAddComment={handleAddComment}
                              onDelete={handleDeleteCard}
                              onUpdate={handleUpdateCard}
                              onReport={handleReportCard}
                            />
                          </motion.div>
                        ))}
                    </AnimatePresence>

                    {cards.length === 0 && !isLoading && (
                      <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 pointer-events-none opacity-50 mx-auto w-full">
                        <LayoutGrid size={50} strokeWidth={1} />
                        <p className="font-black text-xs mt-3 uppercase tracking-widest text-slate-400">등록된 아이디어가 없습니다</p>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          ) : (
            
            /* Render Condition 2: Slido 실시간 소통 View */
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="max-w-4xl mx-auto">
                
                {/* Slido internal tabs switcher */}
                <div className="flex justify-center border-b border-slate-200/50 mb-6 gap-2 bg-white/40 p-1.5 rounded-xl">
                  <button
                    onClick={() => setSlidoSubTab('qna')}
                    type="button"
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${slidoSubTab === 'qna' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    💬 실시간 현장 Q&A
                  </button>
                  <button
                    onClick={() => setSlidoSubTab('poll')}
                    type="button"
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${slidoSubTab === 'poll' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-705'}`}
                  >
                    📊 실시간 투표 (Poll)
                  </button>
                  <button
                    onClick={() => setSlidoSubTab('wordcloud')}
                    type="button"
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${slidoSubTab === 'wordcloud' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-505 hover:text-slate-705'}`}
                  >
                    ☁️ 단어 클라우드 (Word Cloud)
                  </button>
                </div>

                {/* Tab Render: Q&A */}
                {slidoSubTab === 'qna' && (
                  <div className="space-y-4 max-w-xl mx-auto">
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-slate-800">
                      <h4 className="font-black text-xs sm:text-sm text-slate-700 mb-1 flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-indigo-600" />
                        익명으로 물어보기 (실시간 Q&A)
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 mb-3 leading-tight">
                        건의사항, 기술 질문, 무엇이든 물어보세요! 투표를 통해 다른 이들의 호응을 끌어올릴 수 있습니다.
                      </p>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (qnaInput.trim()) {
                            handleAddQnAQuestion(qnaInput.trim());
                            setQnaInput('');
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input 
                          type="text"
                          placeholder="대화나 질문 내용을 적어보세요..."
                          value={qnaInput}
                          onChange={(e) => setQnaInput(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-505 focus:ring-1 focus:ring-indigo-505 rounded-xl px-3 py-2 text-xs font-bold"
                        />
                        <button 
                          type="submit" 
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm shrink-0"
                        >
                          질문 등록
                        </button>
                      </form>
                    </div>

                    <div className="space-y-2.5">
                      {qnas.map(q => (
                        <div key={q.id} className={`p-4 rounded-xl shadow-sm border ${q.answered ? 'bg-emerald-50/50 border-emerald-100 text-slate-850' : 'bg-white border-slate-100 text-slate-850'} transition-all flex items-start justify-between gap-4 animate-in fade-in`}>
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black text-slate-400">{q.author}</span>
                              <span className="text-[9px] text-slate-300">{new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {q.answered && (
                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded-full uppercase">
                                  답변 완료
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] font-semibold text-slate-700 leading-relaxed break-all">{q.text}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={() => handleUpvoteQnAQuestion(q.id)}
                              type="button"
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${
                                q.votedUsers?.includes(auth.currentUser?.uid || '') 
                                  ? 'bg-blue-50 border-blue-200 text-blue-600' 
                                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <span>▲</span>
                              <span>{q.votes || 0}</span>
                            </button>
                            {isAdmin && (
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => handleToggleQnAAnswered(q.id, q.answered)}
                                  type="button"
                                  className="p-1 text-slate-400 hover:text-emerald-500 border border-slate-200 rounded animate-none"
                                  title="답변 완료 토글"
                                >
                                  <Check size={11} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteQnAQuestion(q.id)}
                                  type="button"
                                  className="p-1 text-slate-400 hover:text-red-500 border border-slate-200 rounded text-[9px]"
                                  title="삭제"
                                >
                                  ❌
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {qnas.length === 0 && (
                        <div className="bg-white/40 p-12 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
                          <MessageSquare size={24} className="mx-auto mb-2 opacity-55" />
                          <p className="text-[11px] font-black uppercase tracking-tight">아직 질문이 생성되지 않았습니다</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab Render: Live Poll */}
                {slidoSubTab === 'poll' && (
                  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm max-w-xl mx-auto space-y-5 text-slate-800">
                    <h4 className="font-black text-xs sm:text-sm text-slate-700 flex items-center gap-1.5 mb-1">
                      <BarChartIcon size={14} className="text-indigo-600" />
                      실시간 현장 설문 투표 (Poll)
                    </h4>

                    {polls.length > 0 ? (
                      polls.map(poll => {
                        const currentUserId = auth.currentUser?.uid || '';
                        const hasVoted = poll.votes && poll.votes[currentUserId] !== undefined;
                        const hasVotedOptionIndex = hasVoted ? Number(poll.votes[currentUserId]) : -1;

                        const totalVotes = Object.keys(poll.votes || {}).length;
                        const optionCounts = poll.options.map((_, idx) => {
                          return Object.values(poll.votes || {}).filter(v => v === String(idx)).length;
                        });

                        return (
                          <div key={poll.id} className="border border-slate-100 p-4 rounded-2xl space-y-4">
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${poll.active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                                  {poll.active ? '투표 진행중' : '마감완료'}
                                </span>
                                <h5 className="text-xs sm:text-sm font-black text-slate-800 mt-1.5">{poll.question}</h5>
                              </div>
                              {isAdmin && (
                                <div className="flex gap-1 shrink-0">
                                  <button 
                                    onClick={() => handleTogglePollActive(poll.id, poll.active)}
                                    type="button"
                                    className={`text-[9.5px] font-black px-2 py-1 rounded transition-colors ${poll.active ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}
                                  >
                                    {poll.active ? '종료' : '시작'}
                                  </button>
                                  <button 
                                    onClick={() => handleDeletePoll(poll.id)}
                                    type="button"
                                    className="bg-red-50 hover:bg-red-100 text-red-650 text-[9.5px] font-black px-2 py-1 rounded transition-colors"
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              {poll.options.map((opt, idx) => {
                                const count = optionCounts[idx];
                                const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

                                return (
                                  <div key={idx}>
                                    {hasVoted || !poll.active ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs font-bold text-slate-705">
                                          <span className={idx === hasVotedOptionIndex ? 'font-black text-indigo-600' : 'text-slate-600'}>
                                            {opt} {idx === hasVotedOptionIndex && ' (나의 생각)'}
                                          </span>
                                          <span>{percentage}% ({count}명)</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-500 ${idx === hasVotedOptionIndex ? 'bg-indigo-600' : 'bg-indigo-300'}`}
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleVotePoll(poll.id, idx)}
                                        type="button"
                                        className="w-full text-left p-3 hover:bg-slate-50 hover:border-indigo-300 text-slate-705 font-bold text-xs border border-slate-200 rounded-xl transition-all active:scale-[0.99]"
                                      >
                                        {opt}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <p className="text-[10px] font-bold text-slate-400">총 {totalVotes}명이 소중한 표를 보탰습니다.</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                        <BarChartIcon size={24} className="mx-auto mb-2 opacity-45" />
                        <p className="text-[11px] font-black uppercase tracking-tight">발송된 라이브 투표가 없습니다.</p>
                        {isAdmin && <p className="text-[9.5px] text-slate-400 font-bold mt-1">상단의 퍼실리테이터 설문 도구를 이용해 투표를 생성하세요.</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Render: Word Cloud */}
                {slidoSubTab === 'wordcloud' && (
                  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm max-w-xl mx-auto space-y-5 text-slate-850">
                    <h4 className="font-black text-xs sm:text-sm text-slate-700 mb-1 flex items-center gap-1.5 leading-none">
                      <Volume2 size={14} className="text-indigo-600 animate-pulse" />
                      실시간 현장 단어구름 (Word Cloud)
                    </h4>
                    <p className="text-[10px] font-bold text-slate-405 leading-normal">
                      키워드를 한 단어로 제출해보세요. 동료들의 머릿속 생각을 한 눈에 예쁘게 볼 수 있습니다. (동일 키워드는 중복 불가)
                    </p>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (wordInput.trim()) {
                          handleSubmitWordCloudWord(wordInput.trim());
                          setWordInput('');
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input 
                        type="text"
                        placeholder="전달할 키워드 (예시: 소통, 즐거움)..."
                        value={wordInput}
                        maxLength={15}
                        onChange={(e) => setWordInput(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-505 rounded-xl px-3 py-2 text-xs font-bold"
                      />
                      <button 
                        type="submit" 
                        className="bg-[#9C9373] hover:bg-[#857D5F] text-white font-black text-xs px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm"
                      >
                        키워드 제출
                      </button>
                    </form>

                    <div className="p-6 bg-slate-50 border border-slate-150 rounded-2xl min-h-[220px] flex flex-wrap items-center justify-center gap-4">
                      {wordCloud.length > 0 ? (
                        wordCloud.map(item => {
                          const maxCount = Math.max(...wordCloud.map(w => w.count || 1));
                          const minCount = Math.min(...wordCloud.map(w => w.count || 1));
                          const sizeRange = maxCount - minCount || 1;
                          const fontSize = 11 + ((item.count - minCount) / sizeRange) * 25; // 11px to 36px

                          const colors = ['text-blue-500', 'text-indigo-500', 'text-amber-600', 'text-purple-500', 'text-emerald-500', 'text-teal-500', 'text-rose-500'];
                          const colorClass = colors[item.text.charCodeAt(0) % colors.length];

                          return (
                            <span 
                              key={item.id} 
                              style={{ fontSize: `${fontSize}px` }}
                              className={`font-black uppercase tracking-tight transition-all duration-300 ${colorClass} hover:scale-105 cursor-default p-1.5 inline-block`}
                              title={`${item.count}회 입력됨`}
                            >
                              {item.text}
                              <span className="text-[9px] font-medium opacity-40 ml-0.5">({item.count})</span>
                            </span>
                          );
                        })
                      ) : (
                        <div className="text-center text-slate-350 opacity-55">
                          <p className="text-[11px] font-black uppercase tracking-tight">수집된 키워드가 없습니다</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Chat Sidebar (Right side, embedded Kakao-style layout matches both desktop and tab selection) */}
        <div className={`
          fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-40 lg:w-[350px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)]
          ${activeTab === 'chat' ? 'flex' : 'hidden lg:flex'}
        `}>
           <div className="lg:hidden p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
             <button onClick={() => setActiveTab('board')} type="button" className="text-slate-400 hover:text-slate-600">
                <ChevronLeft size={20} />
             </button>
             <h2 className="font-black text-xs uppercase tracking-widest text-[#0F172A]">서랍 및 대화방</h2>
             <div className="w-5" />
           </div>
           
           <ChatSidebar 
              messages={messages} 
              onSendMessage={handleSendMessage} 
              currentUser={nickname} 
              participantCount={participants.length}
              isAdmin={isAdmin}
              pinnedAnnouncement={pinnedAnnouncement}
              onPinAnnouncement={handlePinAnnouncement}
              onUnpinAnnouncement={handleUnpinAnnouncement}
            />
        </div>
      </div>
    </div>
  </>
  );
}
