/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  LayoutGrid, 
  Users, 
  LogOut, 
  Hash, 
  X, 
  Trash2, 
  Building2, 
  ChevronLeft, 
  Check, 
  Calendar,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  getDocs,
  where
} from 'firebase/firestore';
import { db, ensureAuthenticated, handleFirestoreError, OperationType } from '../lib/firebase';
import { Workspace, WorkspaceBoard } from '../types';

interface AdminDashboardProps {
  nickname: string;
  onExit: () => void;
  onJoinBoard: (code: string) => void;
}

export default function AdminDashboard({ nickname, onExit, onJoinBoard }: AdminDashboardProps) {
  // Database state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [boards, setBoards] = useState<WorkspaceBoard[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal / Creation States
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  
  // Multi-step Board Creation State
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [creationStep, setCreationStep] = useState<'type' | 'details'>('type');
  const [boardType, setBoardType] = useState<'single' | 'workshop'>('single');
  const [boardTitle, setBoardTitle] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceBoard['template']>('brainstorm');

  // Load Workspaces and Boards from Firestore
  useEffect(() => {
    setIsLoading(true);
    let unsubscribeWorkspaces: (() => void) | null = null;
    let unsubscribeRooms: (() => void) | null = null;
    let isMounted = true;

    const initData = async () => {
      try {
        await ensureAuthenticated();
        if (!isMounted) return;

        // Subscribe to Workspaces
        const workspacesRef = collection(db, 'workspaces');
        unsubscribeWorkspaces = onSnapshot(workspacesRef, (snapshot) => {
          const fetchedWorkspaces = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Workspace));
          // Robust in-memory sort by createdAt desc
          fetchedWorkspaces.sort((a, b) => {
            const timeA = a.createdAt ? (typeof a.createdAt === 'object' && (a.createdAt as any).seconds ? (a.createdAt as any).seconds * 1000 : Number(a.createdAt)) : 0;
            const timeB = b.createdAt ? (typeof b.createdAt === 'object' && (b.createdAt as any).seconds ? (b.createdAt as any).seconds * 1000 : Number(b.createdAt)) : 0;
            return timeB - timeA;
          });
          setWorkspaces(fetchedWorkspaces);
          
          // Auto-select first workspace as default for select dropdowns if not set
          if (fetchedWorkspaces.length > 0 && !selectedWorkspaceId) {
            setSelectedWorkspaceId(fetchedWorkspaces[0].id);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'workspaces');
        });

        // Subscribe to Rooms (Boards)
        const roomsRef = collection(db, 'rooms');
        unsubscribeRooms = onSnapshot(roomsRef, (snapshot) => {
          const fetchedBoards = snapshot.docs.map(d => {
            const data = d.data();
            // Handle different types of createdAt: Timestamp object or number or Date
            let timeNum = Date.now();
            if (data.createdAt) {
              if (data.createdAt.seconds !== undefined) {
                timeNum = data.createdAt.seconds * 1000;
              } else if (typeof data.createdAt === 'number') {
                timeNum = data.createdAt;
              } else if (data.createdAt instanceof Date) {
                timeNum = data.createdAt.getTime();
              } else {
                timeNum = Number(data.createdAt) || Date.now();
              }
            }
            return {
              id: d.id, // the 4-digit code
              workspaceId: data.workspaceId || '',
              title: data.title || '이름 없는 보드',
              type: data.type || 'single',
              template: data.template || 'brainstorm',
              createdAt: timeNum
            } as WorkspaceBoard;
          });
          // Sort in-memory desc
          fetchedBoards.sort((a, b) => b.createdAt - a.createdAt);
          setBoards(fetchedBoards);
          setIsLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'rooms');
          setIsLoading(false);
        });

      } catch (err) {
        console.error("Auth / Init error in AdminDashboard:", err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initData();

    return () => {
      isMounted = false;
      if (unsubscribeWorkspaces) unsubscribeWorkspaces();
      if (unsubscribeRooms) unsubscribeRooms();
    };
  }, [selectedWorkspaceId]);

  // Workspace Creation Handler
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    // Generate neat 6-digit upper workspace code: e.g., SDBVE3
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      await ensureAuthenticated();
      const newWs: Workspace = {
        id: code,
        name: newWorkspaceName.trim(),
        createdAt: Date.now()
      };

      const wsPath = `workspaces/${code}`;
      await setDoc(doc(db, 'workspaces', code), newWs);
      setNewWorkspaceName('');
      setShowCreateWorkspaceModal(false);
      setSelectedWorkspaceId(code);
      alert(`새 워크스페이스 "${newWs.name} (${code})"가 생성되었습니다!`);
    } catch (err) {
      console.error("Create workspace error:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `workspaces/${code}`);
      } catch (uiErr) {
        // Log details to dev console & warn user
      }
      alert("워크스페이스 생성에 실패했습니다 (권한 규칙 혹은 DB 에러).");
    }
  };

  // Board Limitation Check & Creation Handler
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardTitle.trim()) {
      alert("보드 제목을 입력하세요.");
      return;
    }
    if (!selectedWorkspaceId) {
      alert("워크스페이스를 선택하거나 먼저 생성하세요.");
      return;
    }

    // Filter boards in the selected workspace to verify 10 limit rule
    const currentWorkspaceBoards = boards.filter(b => b.workspaceId === selectedWorkspaceId);
    if (currentWorkspaceBoards.length >= 10) {
      alert(`⚠️ 생성 한도 초과\n선택한 워크스페이스는 최대 10개의 보드만 생성할 수 있습니다.\n현재 보드 수: ${currentWorkspaceBoards.length}/10`);
      return;
    }

    // Generate a unique 4-digit upper alphanumeric digit entry code: e.g., 25AK
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let isUnique = false;
    let attempts = 0;

    // Assure unique 4-digit code among active boards
    while (!isUnique && attempts < 20) {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (!boards.some(b => b.id === code)) {
        isUnique = true;
      }
      attempts++;
    }

    try {
      await ensureAuthenticated();
      // Setup room metadata in Firestore /rooms/{code}
      await setDoc(doc(db, 'rooms', code), {
        title: boardTitle.trim(),
        workspaceId: selectedWorkspaceId,
        type: boardType,
        template: selectedTemplate,
        skin: 'sand',
        locked: false,
        pinnedAnnouncement: '',
        createdAt: serverTimestamp()
      });

      // Reset modal and transition states
      setShowCreateBoardModal(false);
      setBoardTitle('');
      setCreationStep('type');
      
      alert(`🎉 새 보드가 생성되었습니다!\n방 코드: ${code}`);
      
      // Auto-join the newly created board!
      onJoinBoard(code);
    } catch (err) {
      console.error("Create board error:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `rooms/${code}`);
      } catch (uiErr) {}
      alert("보드 생성 도중 에러가 발생했습니다.");
    }
  };

  const handleDeleteBoard = async (e: React.MouseEvent, boardId: string, title: string) => {
    e.stopPropagation(); // prevent clicking board card
    if (!window.confirm(`[경고] "${title}" 보드를 영구 삭제하시겠습니까? 관련 포스트잇과 데이터가 전부 제거됩니다.`)) return;
    try {
      await ensureAuthenticated();
      await deleteDoc(doc(db, 'rooms', boardId));
    } catch (err) {
      console.error("Delete room error:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `rooms/${boardId}`);
      } catch (uiErr) {}
    }
  };

  const filteredBoards = activeWorkspaceId === 'all' 
    ? boards 
    : boards.filter(b => b.workspaceId === activeWorkspaceId);

  // Elegant Korean Template Descriptive Map
  const templateMap: Record<WorkspaceBoard['template'], { title: string; label: string; desc: string; icon: string; bg: string }> = {
    brainstorm: {
      title: '브레인스토밍',
      label: '💡 브레인스토밍',
      desc: '제약 없이 다양한 의견과 창의적 아이디어를 자유롭게 쏟아내고 기록합니다.',
      icon: '💡',
      bg: 'bg-amber-50 border-amber-200 text-amber-900'
    },
    canvas: {
      title: '캔버스',
      label: '🗺️ 캔버스',
      desc: '자석 화이트보드처럼 원하는 오프셋 좌표에 포스트들을 자유롭게 배치합니다.',
      icon: '🗺️',
      bg: 'bg-indigo-50 border-indigo-200 text-indigo-900'
    },
    procon: {
      title: '찬성 / 반대',
      label: '⚖️ 찬성 / 반대',
      desc: '특정 현안이나 피드백 의제에 대하여 찬성과 반대 의견을 명확하게 나누어 대조합니다.',
      icon: '⚖️',
      bg: 'bg-rose-50 border-rose-200 text-rose-900'
    },
    category: {
      title: '카테고리 섹션',
      label: '🏷️ 카테고리',
      desc: '운영자가 정의한 카테고리들을 바탕으로 일목요연하고 깔끔하게 묶어 축적합니다.',
      icon: '🏷️',
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900'
    },
    kanban: {
      title: '칸반',
      label: '🗂️ 칸반',
      desc: '할 일 · 진행 중 · 완료 세 개의 레인으로 조율하며 활동 진행 프로세스를 관리합니다.',
      icon: '🗂️',
      bg: 'bg-cyan-50 border-cyan-200 text-cyan-900'
    },
    kpt: {
      title: 'KPT 회고',
      label: '🔄 KPT 회고',
      desc: 'Keep(유지), Problem(문제점), Try(시도할 사항) 단계별 카드로 회고 작업을 거칩니다.',
      icon: '🔄',
      bg: 'bg-purple-50 border-purple-200 text-purple-900'
    },
    fourf: {
      title: '4F 회고지',
      label: '📋 4F 회고',
      desc: 'Facts(사실) · Feelings(감정) · Findings(발견) · Future(미래) 관점의 입체적 검토.',
      icon: '📋',
      bg: 'bg-sky-50 border-sky-200 text-sky-900'
    },
    ninebox: {
      title: '9칸 윈도우',
      label: '🔲 9칸 윈도우',
      desc: '과거·현재·미래의 시간과 상위·기본·하위 시스템 축을 결합한 TRIZ 발상 도구 설계.',
      icon: '🔲',
      bg: 'bg-slate-50 border-slate-205 text-slate-800'
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800 antialiased overflow-y-auto">
      {/* Elegantly Crafted Dashboard Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-10 shrink-0 shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md shadow-indigo-100">G</div>
          <span className="text-lg font-black tracking-tight text-slate-900 border-r border-slate-200 pr-4">
            GAM BOARD Admin
          </span>
          <span className="text-slate-400 font-bold text-xs uppercase tracking-wider hidden md:block">
            Control Tower Center
          </span>
        </div>

        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-xl font-bold text-xs text-slate-500">
            <Building2 size={13} className="text-indigo-500" />
            <span>워크스페이스 {workspaces.length}개</span>
          </div>
          <button 
            type="button"
            onClick={onExit} 
            className="text-slate-400 hover:text-red-500 transition-all p-2 rounded-xl hover:bg-red-50 flex items-center justify-center gap-1"
            title="콘솔 로그아웃"
          >
            <LogOut size={16} />
            <span className="text-xs font-bold leading-none hidden sm:block">로그아웃</span>
          </button>
        </div>
      </header>

      {/* Primary Dashboard Content Panel */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-8 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Side Menu: Workspaces filtering Panel */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-400 tracking-wider flex items-center gap-1">
                <Layers size={13} className="text-indigo-500" />
                워크스페이스 목록
              </span>
              <button
                onClick={() => setShowCreateWorkspaceModal(true)}
                className="p-1 hover:bg-slate-55 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all"
                title="새 워크스페이스 만들기"
              >
                <Plus size={14} className="stroke-[3px]" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              <button
                onClick={() => setActiveWorkspaceId('all')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors flex items-center justify-between ${
                  activeWorkspaceId === 'all' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-650 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>🌐 전체 보드 보기</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeWorkspaceId === 'all' ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {boards.length}
                </span>
              </button>

              {workspaces.map((ws) => {
                const totalWsBoards = boards.filter(b => b.workspaceId === ws.id).length;
                return (
                  <button
                    key={ws.id}
                    onClick={() => setActiveWorkspaceId(ws.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
                      activeWorkspaceId === ws.id 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                        : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-black truncate block">{ws.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono tracking-tight font-medium">#{ws.id}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black shrink-0 ${
                      activeWorkspaceId === ws.id ? 'bg-indigo-200 text-indigo-805' : 'bg-slate-50 border border-slate-200 text-slate-400'
                    }`}>
                      {totalWsBoards}/10
                    </span>
                  </button>
                );
              })}
              
              {workspaces.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-slate-150 rounded-xl">
                  <p className="text-[11px] font-bold text-slate-400 leading-normal">제작된 워크스페이스가<br/>없습니다.</p>
                  <button 
                    onClick={() => setShowCreateWorkspaceModal(true)} 
                    className="mt-2 text-[10px] font-black text-indigo-600 hover:underline"
                  >
                    + 워크스페이스 생성
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Members Panel EXACTLY as represented in the first mockup image */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="pb-3 border-b border-slate-100 mb-4 flex items-center gap-1.5">
              <Users size={14} className="text-indigo-500" />
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                멤버 (1)
              </span>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-150 text-indigo-600 font-black text-sm rounded-full flex items-center justify-center shadow-inner">
                  장
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800">장철우</span>
                  <span className="text-[11px] text-slate-400 font-semibold truncate max-w-40">chulwooj50@gmail.com</span>
                </div>
              </div>
              <span className="bg-orange-50 stroke-[2px] text-orange-600 border border-orange-100 font-bold px-2 py-0.5 rounded-md text-[10px] shrink-0 font-bold uppercase tracking-wide">
                관리자
              </span>
            </div>
          </div>
        </div>

        {/* Right Side Board List: Filters and Grid layout */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 select-none bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                📋 보드 ({filteredBoards.length})
              </span>
              <span className="text-slate-400 font-medium text-xs">
                {activeWorkspaceId === 'all' ? '전체 워크스페이스 기준' : `${workspaces.find(w => w.id === activeWorkspaceId)?.name || ''} 내 보드`}
              </span>
            </div>
            
            <button
              onClick={() => {
                if (workspaces.length === 0) {
                  alert("보드를 제작하기 전에 먼저 한 개 이상의 워크스페이스를 생성해야 합니다.");
                  setShowCreateWorkspaceModal(true);
                } else {
                  setShowCreateBoardModal(true);
                  setCreationStep('type');
                }
              }}
              className="bg-[#6366F1] hover:bg-[#5046E5] text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-100 transition-all hover:translate-y-[-1px] active:translate-y-0"
            >
              <Plus size={14} className="stroke-[3px]" />
              <span>새 보드 만들기</span>
            </button>
          </div>

          {/* Boards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBoards.map((b) => {
              const wsName = workspaces.find(w => w.id === b.workspaceId)?.name || '기타';
              return (
                <div
                  key={b.id}
                  onClick={() => onJoinBoard(b.id)}
                  className="bg-white border border-slate-200 hover:border-slate-350 hover:shadow-lg rounded-2xl p-5 cursor-pointer relative group transition-all duration-200 overflow-hidden"
                >
                  {/* Decorative background visual accent */}
                  <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-3xl -z-10 transition-colors group-hover:bg-indigo-50/40" />

                  <div className="flex flex-col h-full justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-[10px] px-2 py-0.5 rounded-md">
                          {b.type === 'single' ? '🎯 단일 보드' : '🎬 워크숍'}
                        </span>
                        <span className="text-slate-400 text-[11px] font-bold">
                          {wsName}
                        </span>
                      </div>
                      
                      <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors pt-1">
                        {b.title}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded bg-[#EEF2F6] font-extrabold">
                        <Hash size={12} className="text-slate-400" />
                        <span className="text-xs text-[#4F46E5] font-mono tracking-tight leading-none pt-[1px]">{b.id}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(b.createdAt).toLocaleDateString()}
                        </span>
                        
                        <button
                          onClick={(e) => handleDeleteBoard(e, b.id, b.title)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-350 hover:text-red-500 rounded-lg hover:bg-slate-50 transition-all shrink-0"
                          title="보드 영구 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredBoards.length === 0 && (
              <div className="col-span-1 md:col-span-2 py-16 bg-white border border-slate-200/60 rounded-3xl flex flex-col items-center justify-center text-center space-y-3">
                <span className="text-4xl">🌵</span>
                <div className="space-y-1">
                  <p className="font-extrabold text-[#1E293B] text-sm">해당 영역에 제작된 보드가 없습니다.</p>
                  <p className="text-xs text-slate-400 font-medium">우측 하단의 '+ 새 보드 만들기'를 누르시면 새로운 회의 세션이 열립니다.</p>
                </div>
                <button
                  onClick={() => {
                    if (workspaces.length === 0) {
                      alert("먼저 워크스페이스를 생성해야 합니다.");
                      setShowCreateWorkspaceModal(true);
                    } else {
                      setShowCreateBoardModal(true);
                      setCreationStep('type');
                    }
                  }}
                  className="mt-2 text-xs font-black text-indigo-600 hover:text-indigo-700 underline"
                >
                  기반 보드 생성하기
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 1. Workspace Creator Modal */}
      <AnimatePresence>
        {showCreateWorkspaceModal && (
          <div 
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm shadow-2xl"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateWorkspaceModal(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <span className="text-sm font-black text-slate-800">새 워크스페이스 만들기</span>
                <button 
                  onClick={() => setShowCreateWorkspaceModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-50 transition-all"
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    회사 / 팀 이름
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 강철팀, 구글 코칭그룹"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all"
                  />
                  <p className="text-[10px] text-slate-400 font-bold leading-normal">
                    생성 시 자동으로 영문·숫자 6자리의 영구 부여 코드가 할당됩니다.
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2.5 text-xs font-black">
                  <button
                    type="button"
                    onClick={() => setShowCreateWorkspaceModal(false)}
                    className="px-4 py-2 border border-slate-205 text-slate-500 rounded-xl hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all active:scale-95"
                  >
                    생성하기
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Board Creator Multi-Step Modal */}
      <AnimatePresence>
        {showCreateBoardModal && (
          <div 
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-sm shadow-2xl"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateBoardModal(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col p-6 sm:p-8 space-y-6 max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 h-10 select-none shrink-0">
                <div className="flex flex-col">
                  <span className="text-base font-black text-slate-800 leading-none">
                    새 보드 만들기
                  </span>
                  {creationStep === 'details' && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mt-1.5">
                      <button 
                        onClick={() => setCreationStep('type')}
                        className="hover:text-indigo-600 flex items-center gap-0.5 text-[11px]"
                      >
                        <ChevronLeft size={12} />
                        유형 변경
                      </button>
                      <span>•</span>
                      <span className="text-slate-500 text-[11px]">
                        {boardType === 'single' ? '🎯 단일 보드' : '🎬 워크숍'}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      setShowCreateBoardModal(false);
                    }}
                    className="text-indigo-500 hover:text-indigo-700 text-xs font-black"
                  >
                    내 보드 목록
                  </button>
                  <button 
                    onClick={() => setShowCreateBoardModal(false)}
                    className="p-1 rounded-full text-slate-400 hover:bg-slate-50"
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Step 1: Select Board Type */}
              {creationStep === 'type' && (
                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  <h3 className="text-sm font-bold text-slate-500">
                    보드 유형을 선택하세요.
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Single Board option */}
                    <div
                      onClick={() => {
                        setBoardType('single');
                        setCreationStep('details');
                      }}
                      className={`border-2 border-slate-150 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 rounded-2xl p-6 cursor-pointer text-left transition-all flex flex-col justify-between group h-48 select-none ${
                        boardType === 'single' ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/20' : ''
                      }`}
                    >
                      <span className="text-3xl filter saturate-120 drop-shadow">🎯</span>
                      <div className="space-y-1 mt-2">
                        <h4 className="font-extrabold text-[#1E293B] text-base group-hover:text-indigo-600 transition-colors">
                          단일 보드
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                          한 가지 템플릿으로 가볍게 작업합니다. <br/>
                          브레인스토밍 · 회고 · 칸반 · 찬반 등.
                        </p>
                      </div>
                      <span className="text-[10px] font-black text-indigo-500/70 block border-t border-slate-100 pt-2 shrink-0">
                        패들렛 스타일 • 빠른 시작
                      </span>
                    </div>

                    {/* Workshop option */}
                    <div
                      onClick={() => {
                        setBoardType('workshop');
                        setCreationStep('details');
                      }}
                      className={`border-2 border-slate-150 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 rounded-2xl p-6 cursor-pointer text-left transition-all flex flex-col justify-between group h-48 select-none ${
                        boardType === 'workshop' ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/20' : ''
                      }`}
                    >
                      <span className="text-3xl filter saturate-120 drop-shadow">🎬</span>
                      <div className="space-y-1 mt-2">
                        <h4 className="font-extrabold text-[#1E293B] text-base group-hover:text-indigo-600 transition-colors">
                          워크숍
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                          여러 단계를 조합해 하나의 워크숍을 진행합니다. <br/>
                          단계별로 활동/시간이 자동 전환됩니다.
                        </p>
                      </div>
                      <span className="text-[10px] font-black text-indigo-500/70 block border-t border-slate-100 pt-2 shrink-0">
                        발산 ➔ 정리 ➔ 투표 등 시퀀스
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Choose details / Title / Template */}
              {creationStep === 'details' && (
                <form onSubmit={handleCreateBoard} className="space-y-5 flex-1 flex flex-col overflow-y-auto pr-1">
                  <span className="text-sm font-bold text-slate-500">
                    보드 제목과 템플릿을 선택하세요.
                  </span>

                  {/* Form fields */}
                  <div className="space-y-4">
                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-700">
                        보드 제목
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="예: Q1 회고 보드"
                        value={boardTitle}
                        onChange={(e) => setBoardTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white rounded-xl px-4 py-3 text-xs font-bold transition-all"
                      />
                    </div>

                    {/* Workspace Selector */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-black text-slate-700">
                          워크스페이스
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCreateWorkspaceModal(true)}
                          className="text-xs font-black text-indigo-650 hover:underline"
                        >
                          + 새 워크스페이스 만들기
                        </button>
                      </div>
                      <select
                        required
                        value={selectedWorkspaceId}
                        onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl px-4 py-3 text-xs font-bold transition-all focus:outline-none"
                      >
                        {workspaces.map((ws) => (
                          <option key={ws.id} value={ws.id}>
                            {ws.name} ({ws.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Template Choice GRID (8 styled cards as shown in reference) */}
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-700 mb-1">
                        템플릿 선택
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        {Object.entries(templateMap).map(([key, item]) => (
                          <div
                            key={key}
                            onClick={() => setSelectedTemplate(key as any)}
                            className={`border rounded-xl p-3 text-left transition-all cursor-pointer hover:shadow hover:scale-[1.01] select-none h-[110px] flex flex-col justify-between ${
                              selectedTemplate === key
                                ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/10'
                                : 'border-slate-200/80 bg-white'
                            }`}
                          >
                            <span className="text-xl">{item.icon}</span>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-800 leading-tight">
                                {item.title}
                              </span>
                              <span className="text-[8.5px] text-slate-400 leading-snug truncate mt-0.5">
                                {item.desc}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submission and limitation */}
                  <div className="pt-2 shrink-0 flex items-center justify-between border-t border-slate-100">
                    <span className="text-[10px] text-slate-405 font-bold">
                      * 보드 생성 시 4자리 고유 코드가 자동 생성됩니다. (최대 10개 한정)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCreationStep('type')}
                        className="px-4 py-2 border border-slate-205 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-55"
                      >
                        이전 단계
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#6366F1] hover:bg-[#5046E5] text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1"
                      >
                        <span>보드 만들기</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
