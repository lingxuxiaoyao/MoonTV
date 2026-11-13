import { useEffect, useRef, useCallback } from 'react';

export interface PlayHistoryPayload {
  [key: string]: any;
}

/**
 * Custom hook to manage play history payload safely without stale closures.
 * Uses useRef to hold the latest payload, throttles saving by 5000ms,
 * and automatically saves on `visibilitychange` when page is hidden.
 */
export function useSafePlayHistory(
  saveHistoryFn: (payload: any) => Promise<void> | void,
  throttleMs = 5000
) {
  const payloadRef = useRef<any>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const saveHistoryFnRef = useRef(saveHistoryFn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveHistoryFnRef.current = saveHistoryFn;
  }, [saveHistoryFn]);

  const flush = useCallback(async () => {
    if (payloadRef.current !== null) {
      const dataToSave = payloadRef.current;
      payloadRef.current = null;
      lastSavedTimeRef.current = Date.now();
      try {
        await saveHistoryFnRef.current(dataToSave);
      } catch (err) {
        console.error('Failed to save play history:', err);
      }
    }
  }, []);

  const updatePayload = useCallback(
    (payload: any) => {
      payloadRef.current = payload;
      const now = Date.now();
      if (now - lastSavedTimeRef.current >= throttleMs) {
        flush();
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          flush();
        }, throttleMs - (now - lastSavedTimeRef.current));
      }
    },
    [flush, throttleMs]
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      flush();
    };
  }, [flush]);

  return {
    updatePayload,
    flush,
    payloadRef,
  };
}

export default useSafePlayHistory;
