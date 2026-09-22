import { useCallback, useEffect, useState } from 'react';

const PROMPT_KEY = 'signage_fs_prompt_dismissed';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

/**
 * Keeps display tablets awake and exposes fullscreen enter/exit.
 * Wake Lock re-acquires when the tab becomes visible again (Chrome drops it).
 */
export function useDisplayKiosk() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => Boolean(document.fullscreenElement),
  );
  const [showPrompt, setShowPrompt] = useState(() => {
    try {
      return sessionStorage.getItem(PROMPT_KEY) !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const wakeLock = navigator.wakeLock;
      if (!wakeLock?.request) return;
      try {
        lock = (await wakeLock.request('screen')) as WakeLockSentinelLike;
        lock.addEventListener('release', () => {
          lock = null;
        });
      } catch {
        /* unsupported / denied — ignore */
      }
    };

    void requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
    try {
      sessionStorage.setItem(PROMPT_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* user denied or unsupported */
    }
    dismissPrompt();
  }, [dismissPrompt]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    showPrompt: showPrompt && !isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    dismissPrompt,
  };
}
