import { Hono } from 'hono';
import type { Env, Variables } from './types/hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import { cfg } from './config';
import * as db from './lib/db-new';

// Import routes
import { authRoutes } from './routes-hono/auth';
import { apiRoutes } from './routes-hono/api';
import { mediaRoutes } from './routes-hono/media';
import { sseRoutes } from './routes-hono/sse';

// Import job queue (starts workers)
import './services/JobQueue';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const port = parseInt(process.env.EBPORT || '3000');

// Session middleware
const sessionStore = SQLiteStore(session);
const sessionMiddleware = session({
  secret: process.env.EBSECRET || 'pleasechangeme',
  resave: false,
  saveUninitialized: false,
  store: new sessionStore({
    db: 'sessions.db',
    dir: './var/db',
  }) as any,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

// Global middleware
app.use('*', logger());

// Wrap express-session for Hono
app.use('*', async (c, next) => {
  await new Promise<void>((resolve, reject) => {
    sessionMiddleware(c.env.incoming as any, c.env.outgoing as any, (err?: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
  await next();
});

// Static files
app.use('/uploads/*', serveStatic({ root: './' }));
app.use('/css/*', serveStatic({ root: './dist/public' }));
app.use('/js/*', serveStatic({ root: './dist/public' }));
app.use('/assets/*', serveStatic({ root: './dist/client' }));
app.use('/favicon.ico', serveStatic({ path: './dist/public/favicon.ico' }));
app.use('/site.webmanifest', serveStatic({ path: './dist/public/site.webmanifest' }));
app.use('/apple-touch-icon.png', serveStatic({ path: './dist/public/apple-touch-icon.png' }));
app.use('/android-chrome-192x192.png', serveStatic({ path: './dist/public/android-chrome-192x192.png' }));
app.use('/android-chrome-512x512.png', serveStatic({ path: './dist/public/android-chrome-512x512.png' }));
app.use('/favicon-16x16.png', serveStatic({ path: './dist/public/favicon-16x16.png' }));
app.use('/favicon-32x32.png', serveStatic({ path: './dist/public/favicon-32x32.png' }));

// Login redirect
app.get('/login', (c) => c.redirect('/auth/login'));

// Mount routes
app.route('/api', apiRoutes);
app.route('/auth', authRoutes);
app.route('/', mediaRoutes);
app.route('/', sseRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    processVideo: cfg.processVideo,
  });
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    {
      error: err.message || 'Internal Server Error',
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
console.log('Process video:', cfg.processVideo);
console.log(`Starting Hono server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`🚀 Hono server running on http://localhost:${port}`);
