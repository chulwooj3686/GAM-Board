/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Shield, User } from 'lucide-react';
import { UserRole } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db, ensureAuthenticated } from '../lib/firebase';

interface OnboardingProps {
  onJoin: (code: string, nickname: string, role: UserRole, targetDashboard?: boolean) => void;
}

export default function Onboarding({ onJoin }: OnboardingProps) {
  const [step, setStep] = useState<'code' | 'facilitator' | 'name'>('code');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [password, setPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNextStep = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 'code') {
      const roomCode = code.trim().toUpperCase();
      if (roomCode.length === 0) {
        setError('입장 코드를 입력하세요.');
        return;
      }
      setIsJoining(true);
      try {
        await ensureAuthenticated();
        const roomRef = doc(db, 'rooms', roomCode);
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
          setError('해당 입장 코드로 등록된 보드가 존재하지 않습니다. 관리자가 생성한 정확한 코드를 입력해주십시오.');
          return;
        }
        setRole('user');
        setStep('name');
      } catch (err) {
        console.error('Verify room error:', err);
        setError('입장 코드 검증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setIsJoining(false);
      }
    } else if (step === 'facilitator') {
      const secret = (import.meta as any).env.VITE_FACILITATOR_PASSWORD || 'admin1234';
      if (password !== secret) {
        setError('비밀번호가 올바르지 않습니다.');
        return;
      }
      setRole('admin');
      // Facilitators skip nickname name step for now or we can use "Facilitator" as default
      setNickname('Facilitator');
      handleFinalJoin('Facilitator', 'admin', true);
    } else if (step === 'name') {
      if (nickname.trim().length === 0) {
        setError('이름을 입력하세요.');
        return;
      }
      handleFinalJoin(nickname.trim(), 'user');
    }
  };

  const handleFinalJoin = async (name: string, userRole: UserRole, targetDashboard?: boolean) => {
    setIsJoining(true);
    try {
      await onJoin(code.trim(), name, userRole, targetDashboard);
    } catch (error) {
      console.error('Join error:', error);
      setIsJoining(false);
      setError('입장 중 오류가 발생했습니다.');
    }
  };

  const renderCodeStep = () => (
    <form onSubmit={handleNextStep} className="space-y-6">
      <div className="space-y-1.5">
        <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider">
          입장 코드 (4자리)
        </label>
        <input
          type="text"
          placeholder="0000"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="hd-input w-full text-2xl tracking-[0.5em] text-center font-mono font-bold"
          required
        />
      </div>

      {error && <p className="text-red-500 text-[11px] font-bold text-center leading-relaxed">{error}</p>}

      <button type="submit" disabled={isJoining} className="hd-button-primary w-full h-12 relative overflow-hidden">
        {isJoining ? (
          <span className="flex items-center gap-2 justify-center">
            <motion.span 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
            />
            코드 확인 중...
          </span>
        ) : '입장하기'}
      </button>

      <div className="pt-4 border-t border-slate-100">
        <button 
          type="button"
          onClick={() => {
            setError(null);
            setStep('facilitator');
          }}
          className="w-full text-slate-400 hover:text-slate-600 text-[12px] font-bold transition-colors"
        >
          관리자(퍼실리테이터) 로그인
        </button>
      </div>
    </form>
  );

  const renderFacilitatorStep = () => (
    <form onSubmit={handleNextStep} className="space-y-6">
      <div className="space-y-1.5">
        <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider">
          관리자 비밀번호
        </label>
        <input
          type="password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="hd-input w-full"
          required
          autoFocus
        />
      </div>

      {error && <p className="text-red-500 text-[11px] font-bold text-center">{error}</p>}

      <div className="flex flex-col gap-3">
        <button type="submit" disabled={isJoining} className="hd-button-primary w-full h-12 bg-slate-800 hover:bg-slate-900 border-none">
          {isJoining ? '로그인 중...' : '관리자 입장'}
        </button>
        <button 
          type="button"
          onClick={() => setStep('code')}
          className="text-slate-400 hover:text-slate-600 text-[11px] font-bold"
        >
          뒤로 가기
        </button>
      </div>
    </form>
  );

  const renderNameStep = () => (
    <form onSubmit={handleNextStep} className="space-y-6">
      <div className="space-y-1.5">
        <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider">
          본인의 이름을 입력하세요
        </label>
        <input
          type="text"
          placeholder="홍길동"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="hd-input w-full"
          required
          autoFocus
          disabled={isJoining}
        />
      </div>

      {error && <p className="text-red-500 text-[11px] font-bold text-center">{error}</p>}

      <div className="flex flex-col gap-3">
        <button type="submit" disabled={isJoining} className="hd-button-primary w-full h-12 relative overflow-hidden">
          {isJoining ? (
            <span className="flex items-center gap-2 justify-center">
              <motion.span 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
              입장 중...
            </span>
          ) : '보드 입장하기'}
        </button>
        <button 
          type="button"
          onClick={() => setStep('code')}
          className="text-slate-400 hover:text-slate-600 text-[11px] font-bold"
        >
          코드 다시 입력
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F1F5F9]">
      <motion.div 
        key={step}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="hd-card p-10 max-w-sm w-full bg-white shadow-xl"
      >
        <header className="mb-8 text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded flex items-center justify-center font-bold text-white text-2xl mx-auto mb-4 shadow-lg">G</div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">GAM BOARD</h1>
          <p className="text-slate-500 text-[11px] font-bold uppercase mt-1 tracking-widest">
            {step === 'code' ? 'Welcome' : step === 'facilitator' ? 'Facilitator Login' : 'Identify Yourself'}
          </p>
        </header>

        {step === 'code' && renderCodeStep()}
        {step === 'facilitator' && renderFacilitatorStep()}
        {step === 'name' && renderNameStep()}

        <footer className="mt-8 pt-6 border-t border-slate-100 flex justify-center text-[10px] text-slate-400 font-medium">
          <span>© 2026 GAM BOARD. Online Coaching Day</span>
        </footer>
      </motion.div>
    </div>
  );
}
