import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { progressManager } from '../services/ProgressManager';
import { cfg } from '../config';
import type { Env, Variables } from '../types/hono';

export const sseRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// SSE Progress Updates
sseRoutes.get('/progress-updates', async (c) => {
  if (!cfg.processVideo) {
    return c.json({ error: 'Video processing is disabled' }, 404);
  }

  console.log('[SSE] New connection requested');

  return streamSSE(c, async (stream) => {
    // Send initial connection message
    await stream.writeSSE({
      data: JSON.stringify({ type: 'connected' }),
    });

    // Set up keepalive
    const keepAliveInterval = setInterval(async () => {
      try {
        await stream.writeSSE({
          data: '',
          event: 'keepalive',
        });
      } catch (error) {
        console.error('[SSE] Keepalive error, closing connection:', error);
        clearInterval(keepAliveInterval);
        cleanup();
      }
    }, 30000); // Increase to 30 seconds

    // Progress update handler
    const handleProgress = async (update: any) => {
      try {
        await stream.writeSSE({
          data: JSON.stringify(update),
        });
      } catch (error) {
        console.error('[SSE] Error sending update:', error);
        cleanup();
      }
    };

    // Subscribe to updates
    progressManager.subscribeToUpdates(handleProgress);

    // Cleanup function
    const cleanup = () => {
      console.log('[SSE] Connection closed, cleaning up');
      clearInterval(keepAliveInterval);
      progressManager.unsubscribeFromUpdates(handleProgress);
    };

    // Handle client disconnect
    stream.onAbort(() => {
      console.log('[SSE] Client aborted connection');
      cleanup();
    });

    // Keep stream alive indefinitely
    await stream.sleep(2147483647); // Maximum 32-bit signed integer
  });
});
