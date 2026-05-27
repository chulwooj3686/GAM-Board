/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Link as LinkIcon, MessageSquare, ExternalLink, Users, FileText, Download, Paperclip, X, Pin, FolderOpen } from 'lucide-react';
import { Message } from '../types';

interface ChatSidebarProps {
  messages: Message[];
  onSendMessage: (text: string, type: Message['type'], link?: string, fileName?: string, fileSize?: string) => void;
  currentUser: string;
  participantCount: number;
  isAdmin?: boolean;
  pinnedAnnouncement?: string;
  onPinAnnouncement?: (text: string) => void;
  onUnpinAnnouncement?: () => void;
}

export default function ChatSidebar({ 
  messages, 
  onSendMessage, 
  currentUser, 
  participantCount,
  isAdmin = false,
  pinnedAnnouncement = '',
  onPinAnnouncement,
  onUnpinAnnouncement
}: ChatSidebarProps) {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'media'>('chat');
  const [isPinnedVisible, setIsPinnedVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pinnedAnnouncement) {
      setIsPinnedVisible(true);
    }
  }, [pinnedAnnouncement]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText, 'chat');
      setInputText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const size = (file.size / 1024 / 1024).toFixed(2) + ' MB';
      onSendMessage(`${file.name} 파일을 공유했습니다.`, 'file', undefined, file.name, size);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const mediaMessages = messages.filter(m => m.type === 'file' || m.type === 'resource' || /(https?:\/\/[^\s]+)/.test(m.text));

  return (
    <aside className="w-full flex-1 bg-white flex flex-col h-full overflow-hidden shrink-0">
      {/* 1. Header (Sub-Tabs switcher) */}
      <div className="border-b border-slate-100 bg-white shrink-0 flex items-center justify-between px-2">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('chat')}
            type="button"
            className={`px-4 py-3 text-xs font-black uppercase tracking-tight flex items-center gap-1.5 border-b-2 transition-colors ${activeTab === 'chat' ? 'text-blue-500 border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          >
            <MessageSquare size={13} />
            <span>대화</span>
          </button>
          <button 
            onClick={() => setActiveTab('media')}
            type="button"
            className={`px-4 py-3 text-xs font-black uppercase tracking-tight flex items-center gap-1.5 border-b-2 transition-colors ${activeTab === 'media' ? 'text-blue-500 border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          >
            <FolderOpen size={13} />
            <span>자료실</span>
          </button>
        </div>
        <div className="px-3 py-1 flex items-center gap-1.5 text-slate-400 text-[10px] font-black">
          <Users size={11} />
          <span>{participantCount} 명</span>
        </div>
      </div>

      {/* 2. Pinned Announcement Bar */}
      {pinnedAnnouncement && isPinnedVisible && (
        <div className="bg-[#FFFCE8] border-b border-[#F2E8B6] px-4 py-2.5 flex items-start gap-2 text-xs shrink-0 animate-in fade-in slide-in-from-top duration-200">
          <Pin size={12} className="text-orange-500 shrink-0 mt-0.5 fill-orange-500" />
          <div className="flex-1 font-semibold text-slate-700 break-all leading-normal text-[11px]">
            {pinnedAnnouncement}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && onUnpinAnnouncement && (
              <button 
                onClick={onUnpinAnnouncement} 
                className="text-slate-400 hover:text-red-500 font-bold text-[9px]"
              >
                해제
              </button>
            )}
            <button 
              onClick={() => setIsPinnedVisible(false)} 
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      {!isPinnedVisible && pinnedAnnouncement && (
        <div className="text-right px-4 py-1.5 bg-slate-50 border-b border-slate-100 shrink-0">
          <button 
            onClick={() => setIsPinnedVisible(true)}
            className="text-[10px] text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 ml-auto"
          >
            <Pin size={10} className="text-orange-400" /> 공지보기
          </button>
        </div>
      )}

      {/* 3. Panel Body */}
      {activeTab === 'chat' ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth bg-white">
          {messages.map((msg) => (
            <div key={msg.id} className="group animate-in fade-in slide-in-from-bottom-1 duration-300">
              <div className={`p-4 rounded-xl shadow-sm border border-slate-100 ${msg.user === currentUser ? 'bg-indigo-50/30' : 'bg-[#F9F7F2]'}`}>
                <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {renderTextWithLinks(msg.text)}
                </p>
                
                {msg.type === 'resource' && msg.link && (
                  <a 
                    href={msg.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-lg text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    <span className="text-[11px] font-bold truncate">링크 열기</span>
                  </a>
                )}

                {msg.type === 'file' && (
                  <div className="mt-3 flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg text-slate-700">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={16} className="text-slate-400 shrink-0" />
                      <span className="text-[11px] font-bold truncate">{msg.fileName}</span>
                    </div>
                    <Download size={14} className="text-slate-300 hover:text-blue-500 transition-colors cursor-pointer" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 px-1">
                <span className="text-[10px] font-bold text-slate-400">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    type="button"
                    onClick={() => navigator.clipboard.writeText(msg.text)} 
                    className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-tighter"
                  >
                    Copy
                  </button>
                  {isAdmin && onPinAnnouncement && (
                    <button 
                      type="button"
                      onClick={() => onPinAnnouncement(msg.text)} 
                      className="text-[10px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-tighter flex items-center gap-0.5"
                    >
                      <Pin size={8} /> 공지등록
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mt-1 px-1">
                <span className="text-[11px] font-black text-slate-800">{msg.user}</span>
              </div>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center pt-20 text-slate-300 opacity-50">
              <MessageSquare size={32} />
              <p className="text-[11px] font-black uppercase tracking-tighter mt-2">No messages yet</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9F7F2]">
          {mediaMessages.map((msg) => (
            <div key={msg.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm group animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-slate-800">{msg.user}</span>
                <span className="text-[9px] text-slate-400 font-bold">
                  {new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mb-3 limit-lines leading-relaxed break-all">
                {msg.text}
              </p>
              
              {msg.type === 'file' && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText size={14} className="text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold truncate text-slate-700">{msg.fileName}</span>
                  </div>
                  <Download size={14} className="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer shrink-0" />
                </div>
              )}
              
              {(msg.type === 'resource' || /(https?:\/\/[^\s]+)/.test(msg.text)) && (
                <a 
                  href={msg.link || msg.text.match(/(https?:\/\/[^\s]+)/)?.[0]} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-blue-50 p-2.5 rounded-lg text-blue-500 hover:text-blue-600 transition-colors text-[11px] font-black border border-blue-100"
                >
                  <ExternalLink size={12} className="shrink-0" />
                  <span className="truncate">공유 자료 링크 열기</span>
                </a>
              )}
            </div>
          ))}
          {mediaMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center pt-20 text-slate-300 opacity-60">
              <FolderOpen size={32} />
              <p className="text-[11px] font-black uppercase tracking-tighter mt-2">공유된 자료가 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* 4. Chat Input Section */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSend} className="relative">
          <textarea
            rows={1}
            placeholder="메시지를 입력하세요..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
            className="w-full bg-[#F1F5F9] border-none focus:ring-0 rounded-2xl pl-10 pr-12 py-3 text-sm font-medium placeholder:text-slate-400 max-h-32 resize-none"
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
          >
            <Paperclip size={18} />
          </button>
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full shadow-lg h-8 disabled:opacity-30 disabled:shadow-none hover:bg-blue-600 transition-all font-black"
          >
            <Send size={14} />
          </button>
        </form>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
      </div>
    </aside>
  );
}
