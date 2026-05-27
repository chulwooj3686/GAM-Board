// src/hooks/useIsDesktop.ts
// ✅ Fix 3: window.matchMedia를 렌더 중 직접 호출하지 말고 이 훅으로 대체.
// 기존 Board.tsx의 ((activeTab === 'board' && !window.matchMedia('(min-width: 1024px)').matches) || ...)
// → ((activeTab === 'board' && !isDesktop) || (desktopTab === 'board' && isDesktop))

import { useState, useEffect } from 'react';

const DESKTOP_BREAKPOINT = '(min-width: 1024px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    // 초기값: SSR 환경에서는 false, 브라우저에서는 실제값
    if (typeof window === 'undefined') return false;
    return window.matchMedia(DESKTOP_BREAKPOINT).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia(DESKTOP_BREAKPOINT);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);

    // addEventListner 방식 (구형 브라우저 대비 addListener도 fallback 가능)
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
