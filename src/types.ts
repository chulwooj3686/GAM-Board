/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Comment {
  id: string;
  author: string;
  authorId: string;
  text: string;
  timestamp: number;
}

export interface Card {
  id: string;
  title: string;
  author: string;
  authorId: string;
  content: string;
  color: 'yellow' | 'pink' | 'purple' | 'cyan' | 'green';
  likes: number;
  comments: Comment[];
  timestamp: number;
  reportedBy?: string[]; // List of userIds who reported this card for Padlet facilitator tools
}

export interface Message {
  id: string;
  user: string;
  userId: string;
  text: string;
  type: 'chat' | 'resource' | 'file';
  link?: string;
  fileName?: string;
  fileSize?: string;
  timestamp: number;
}

export type UserRole = 'admin' | 'user';

export interface Participant {
  id: string;
  name: string;
  role: UserRole;
  lastSeen: number;
}

export type AppState = 'onboarding' | 'board' | 'admin-dashboard';

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

export interface WorkspaceBoard {
  id: string; // 4-digit code e.g. "25AK"
  workspaceId: string;
  title: string;
  type: 'single' | 'workshop';
  template: 'brainstorm' | 'canvas' | 'procon' | 'category' | 'kanban' | 'kpt' | 'fourf' | 'ninebox';
  createdAt: number;
}


// Slido Poll type
export interface SlidoPoll {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, string>; // userId -> optionIndex as string
  active: boolean;
  timestamp: number;
}

// Slido Q&A Question type
export interface QnAQuestion {
  id: string;
  text: string;
  author: string;
  authorId: string;
  votes: number;
  votedUsers: string[]; // List of userIds who upvoted
  answered: boolean;
  timestamp: number;
}

// Slido Word Cloud item
export interface WordCloudItem {
  id: string;
  text: string;
  count: number;
  submittedBy: string[]; // List of userIds to prevent multiple submissions
}
