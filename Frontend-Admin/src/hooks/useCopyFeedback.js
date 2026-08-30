import { useCallback, useEffect, useRef, useState } from 'react';

export function useCopyFeedback({ duration = 2000 } = {}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const copyToClipboard = useCallback(
    async (text, key, onSuccess, onError) => {
      if (!text) return false;

      try {
        await navigator.clipboard.writeText(String(text));
        setCopiedKey(key);
        onSuccess?.();

        if (resetTimerRef.current) {
          clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = setTimeout(() => {
          setCopiedKey(null);
          resetTimerRef.current = null;
        }, duration);
        return true;
      } catch (error) {
        onError?.(error);
        return false;
      }
    },
    [duration],
  );

  return { copiedKey, copyToClipboard };
}
