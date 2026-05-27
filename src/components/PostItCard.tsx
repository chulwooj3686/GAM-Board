/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Send, MoreVertical, Edit2, Trash2, Check, X, AlertTriangle, Flag, Maximize2 } from 'lucide-react';
import { Card, Comment } from '../types';

interface PostItCardProps {
  card: Card;
  currentUserId: string;
  isAdmin?: boolean;
  onLike: (id: string) => void;
  onAddComment: (cardId: string, text: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Card>) => void;
  onReport?: (id: string) => void;
}

export default function PostItCard({ card, currentUserId, isAdmin = false, onLike, onAddComment, onDelete, onUpdate, onReport }: PostItCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title || '');
  const [editContent, setEditContent] = useState(card.content);
  const [showActions, setShowActions] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const isAuthor = card.authorId === currentUserId;
  const canManage = isAuthor || isAdmin;
  const reportsCount = card.reportedBy?.length || 0;
  const isReportedByMe = card.reportedBy?.includes(currentUserId) || false;

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onAddComment(card.id, commentText.trim());
      setCommentText('');
    }
  };

  const handleUpdate = () => {
    if (editContent.trim()) {
      onUpdate(card.id, { title: editTitle, content: editContent });
      setIsEditing(false);
    }
  };

  const cancelEdit = () => {
    setEditTitle(card.title || '');
    setEditContent(card.content);
    setIsEditing(false);
  };

  const getStickyColor = (color: Card['color']) => {
    switch (color) {
      case 'pink': return 'bg-[#FFD1DC] border-[#F2C1CE]';
      case 'purple': return 'bg-[#E0BBE4] border-[#D0ABC4]';
      case 'cyan': return 'bg-[#B2E2F2] border-[#A2D2E2]';
      case 'green': return 'bg-[#C1E1C1] border-[#B1D1B1]';
      case 'yellow': default: return 'bg-[#FFF2AD] border-[#F2E29D]';
    }
  };

  const getTextColor = (color: Card['color']) => {
    switch (color) {
      case 'pink': return 'text-[#8C5D6B]';
      case 'purple': return 'text-[#6D5D8C]';
      case 'cyan': return 'text-[#4A7F8E]';
      case 'green': return 'text-[#5D8C5D]';
      case 'yellow': default: return 'text-[#857640]';
    }
  };

  return (
    <>
      <motion.div
        layout
        className={`rounded-lg border-b-2 shadow-sm relative group overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-md ${getStickyColor(card.color)}`}
      >
      <div className="p-5 pb-3">
        {isEditing ? (
          <div className="space-y-3">
            <textarea 
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[120px] p-0 font-bold text-lg text-slate-800 placeholder:opacity-50"
              placeholder="내용을 입력하세요..."
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={cancelEdit} className="p-2 text-slate-500 hover:text-slate-700">
                <X size={18} />
              </button>
              <button onClick={handleUpdate} className="p-2 text-blue-600 hover:text-blue-800">
                <Check size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="min-h-[120px] cursor-pointer relative select-none pr-4" 
            onClick={() => setIsZoomed(true)}
            title="클릭해서 포스트잇 확대하기"
          >
            <p className={`font-bold text-lg whitespace-pre-wrap leading-tight mb-4 ${getTextColor(card.color)}`}>
              {card.content}
            </p>
            <div className={`absolute top-0 right-0 opacity-0 group-hover:opacity-40 transition-opacity p-0.5`}>
              <Maximize2 size={13} className={getTextColor(card.color)} />
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-3 flex items-center justify-between border-t border-black/5">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-black uppercase tracking-tight ${getTextColor(card.color)} opacity-70`}>{card.author}</span>
          <span className="text-[10px] text-black/20 font-bold">{new Date(card.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {reportsCount > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <AlertTriangle size={8} />
              <span>신고 {reportsCount}</span>
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => onLike(card.id)}
            className="flex items-center gap-1 group/like"
          >
            <Heart 
              size={14} 
              className={`transition-all ${card.likes > 0 ? 'fill-red-500 text-red-500' : 'text-black/20 group-hover/like:text-red-400'}`} 
            />
            {card.likes > 0 && <span className="text-[11px] font-black text-red-500">{card.likes}</span>}
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 group/msg"
          >
            <MessageCircle size={14} className="text-black/20 group-hover/msg:text-blue-500 transition-colors" />
            {(card.comments?.length || 0) > 0 && <span className="text-[11px] font-black text-blue-500">{card.comments.length}</span>}
          </button>

          {!isEditing && (
             <div className="relative">
                <button 
                  onClick={() => setShowActions(!showActions)}
                  className="text-black/10 hover:text-black/40 transition-colors p-1"
                >
                  <MoreVertical size={14} />
                </button>
                <AnimatePresence>
                  {showActions && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 bottom-full mb-1 w-24 bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-20"
                      onMouseLeave={() => setShowActions(false)}
                    >
                      {canManage && (
                        <>
                          <button onClick={() => { setIsEditing(true); setShowActions(false); }} className="w-full px-3 py-1.5 text-[10px] font-black text-slate-600 hover:bg-slate-50 flex items-center gap-2 uppercase text-left">
                            <Edit2 size={10} /> Edit
                          </button>
                          <button onClick={() => { onDelete(card.id); setShowActions(false); }} className="w-full px-3 py-1.5 text-[10px] font-black text-red-500 hover:bg-red-50 flex items-center gap-2 uppercase text-left">
                            <Trash2 size={10} /> Delete
                          </button>
                        </>
                      )}
                      {!isAuthor && onReport && (
                        <button 
                          onClick={() => { onReport(card.id); setShowActions(false); }} 
                          className={`w-full px-3 py-1.5 text-[10px] font-black flex items-center gap-2 uppercase text-left ${isReportedByMe ? 'text-orange-500 hover:bg-orange-50' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          <Flag size={10} /> {isReportedByMe ? '신고 취소' : '신고'}
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          )}
        </div>
      </div>

      {showComments && (
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          className="bg-black/5 border-t border-black/5 p-4"
        >
          <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
            {card.comments?.map(c => (
              <div key={c.id} className="text-[11px] leading-snug">
                <span className="font-black mr-1">{c.author}</span>
                <span className="text-black/60">{c.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmitComment} className="flex gap-1">
            <input 
              type="text" 
              placeholder="댓글..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-white/50 border-none rounded px-2 py-1 text-[11px] focus:ring-0"
            />
            <button type="submit" className="p-1 text-black/30 hover:text-black/60"><Send size={12} /></button>
          </form>
        </motion.div>
      )}
    </motion.div>

    {/* Zoom Overlay Popup */}
    <AnimatePresence>
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsZoomed(false);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className={`w-full max-w-lg rounded-2xl border-b-4 shadow-2xl overflow-hidden text-slate-800 ${getStickyColor(card.color)}`}
          >
            {/* Header Area */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-black/5">
              <span className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${getTextColor(card.color)} opacity-75`}>
                <Maximize2 size={12} />
                포스트잇 크게 보기
              </span>
              <button 
                onClick={() => setIsZoomed(false)}
                className="p-1 rounded-full text-black/30 hover:text-black/65 hover:bg-black/5 transition-colors"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sticky Card Content */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="min-h-[120px] select-text">
                <p className={`font-black text-xl sm:text-2xl whitespace-pre-wrap leading-relaxed ${getTextColor(card.color)}`}>
                  {card.content}
                </p>
              </div>

              {/* Author Info & Interaction Box */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-4">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black uppercase tracking-tight ${getTextColor(card.color)}`}>
                    {card.author}
                  </span>
                  <span className="text-[10px] text-black/30 font-bold">
                    {new Date(card.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {reportsCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <AlertTriangle size={10} />
                      <span>신고 {reportsCount}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      onLike(card.id);
                    }}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 hover:bg-black/10 text-xs font-black uppercase rounded-xl transition-all"
                  >
                    <Heart 
                      size={14} 
                      className={`transition-all ${card.likes > 0 ? 'fill-red-500 text-red-500 scale-110' : 'text-black/30'}`} 
                    />
                    <span className={card.likes > 0 ? 'text-red-500' : 'text-black/50'}>
                      {card.likes > 0 ? `${card.likes} 공감` : '공감'}
                    </span>
                  </button>

                  {!isAuthor && onReport && (
                    <button 
                      onClick={() => {
                        onReport(card.id);
                      }}
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 bg-black/5 hover:bg-black/10 text-xs font-black uppercase rounded-xl transition-all ${isReportedByMe ? 'text-orange-600' : 'text-black/50'}`}
                    >
                      <Flag size={14} className={isReportedByMe ? 'fill-orange-500' : ''} />
                      <span>{isReportedByMe ? '신고됨' : '신고'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Comments Thread */}
            <div className="bg-black/5 p-5 border-t border-black/5 space-y-3.5">
              <h5 className="text-[11px] font-black text-black/45 flex items-center gap-1.5 uppercase tracking-wider">
                <MessageCircle size={14} />
                댓글 소통 ({card.comments?.length || 0})
              </h5>

              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {card.comments && card.comments.length > 0 ? (
                  card.comments.map(c => (
                    <div key={c.id} className="text-[11px] bg-white/50 hover:bg-white/80 p-2.5 rounded-xl border border-black/5 leading-normal animate-in fade-in">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-black/75">{c.author}</span>
                        <span className="text-[9px] text-black/30 font-bold">
                          {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-black/75 font-semibold break-all whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-black/35 font-bold italic text-center py-4">아직 소통 댓글이 없습니다. 첫 의견을 작성해보세요!</p>
                )}
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (commentText.trim()) {
                    onAddComment(card.id, commentText.trim());
                    setCommentText('');
                  }
                }} 
                className="flex gap-2"
              >
                <input 
                  type="text" 
                  placeholder="의견 및 댓글을 남겨보세요..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-white/70 border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-black/20"
                />
                <button 
                  type="submit" 
                  disabled={!commentText.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400/40 text-white font-black text-xs rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
                >
                  <Send size={12} />
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
