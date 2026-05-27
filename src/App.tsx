/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Onboarding from './components/Onboarding';
import Board from './components/Board';
import AdminDashboard from './components/AdminDashboard';
import { AppState, UserRole } from './types';

export default function App() {
  const [state, setState] = useState<AppState>('onboarding');
  const [roomData, setRoomData] = useState({ code: '', nickname: '', role: 'user' as UserRole });

  const handleJoin = async (code: string, nickname: string, role: UserRole, targetDashboard?: boolean) => {
    if (targetDashboard && role === 'admin') {
      setRoomData({ code: '', nickname: 'Facilitator', role: 'admin' });
      setState('admin-dashboard');
    } else {
      setRoomData({ code, nickname, role });
      setState('board');
    }
  };

  const handleJoinBoardFromDashboard = (code: string) => {
    setRoomData({ code, nickname: 'Facilitator', role: 'admin' });
    setState('board');
  };

  const handleExit = () => {
    setState('onboarding');
    setRoomData({ code: '', nickname: '', role: 'user' });
  };

  const handleBoardExit = () => {
    if (roomData.role === 'admin') {
      setState('admin-dashboard');
    } else {
      handleExit();
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden">
      {state === 'onboarding' ? (
        <Onboarding onJoin={handleJoin} />
      ) : state === 'admin-dashboard' ? (
        <AdminDashboard 
          nickname={roomData.nickname} 
          onExit={handleExit} 
          onJoinBoard={handleJoinBoardFromDashboard} 
        />
      ) : (
        <Board 
          roomCode={roomData.code} 
          nickname={roomData.nickname} 
          role={roomData.role}
          onExit={handleBoardExit} 
        />
      )}
    </div>
  );
}

