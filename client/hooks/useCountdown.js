import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing countdown timer.
 * Returns { seconds, isRunning, start, stop, reset }
 */
export function useCountdown(initialSeconds = 8) {
  const [seconds, setSeconds] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const onCompleteRef = useRef(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setSeconds(null);
  }, []);

  const start = useCallback((duration, onComplete) => {
    stop();
    onCompleteRef.current = onComplete;
    setSeconds(duration || initialSeconds);
    setIsRunning(true);

    let remaining = duration || initialSeconds;

    intervalRef.current = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsRunning(false);
        setSeconds(null);
        if (onCompleteRef.current) onCompleteRef.current();
      } else {
        setSeconds(remaining);
      }
    }, 1000);
  }, [initialSeconds, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { seconds, isRunning, start, stop };
}
