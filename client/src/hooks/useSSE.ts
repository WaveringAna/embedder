import { useEffect, useRef, useCallback } from 'react';
import { ProgressUpdate } from '../types';

interface UseSSEOptions {
  onMessage: (data: ProgressUpdate) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  enabled?: boolean;
}

export const useSSE = ({ onMessage, onError, onOpen, enabled = true }: UseSSEOptions) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('[SSE] Connecting to /progress-updates...');
    const evtSource = new EventSource('/progress-updates');

    evtSource.onopen = () => {
      console.log('[SSE] Connection established');
      reconnectAttempts.current = 0;
      if (onOpen) onOpen();
    };

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('[SSE] Initial connection confirmed');
          return;
        }

        console.log('[SSE] Received update:', data);
        onMessage(data);
      } catch (err) {
        console.error('[SSE] Error parsing message:', err);
      }
    };

    evtSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);

      if (evtSource.readyState === EventSource.CLOSED) {
        console.log('[SSE] Connection closed by server');

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current - 1);

          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[SSE] Max reconnect attempts reached');
        }
      }

      if (onError) onError(error);
    };

    eventSourceRef.current = evtSource;
  }, [enabled, onMessage, onError, onOpen]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      console.log('[SSE] Cleaning up connection');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return { disconnect, reconnect: connect };
};
