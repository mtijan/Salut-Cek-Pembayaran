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
    (text, key, onSuccess) => {
      if (!text) return false;

      navigator.clipboard.writeText(text);
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
    },
    [duration],
  );

  return { copiedKey, copyToClipboard };
}
