import { Hono } from 'hono';
import crypto from 'crypto';
import { getUserByUsername } from '../lib/db-new';
import type { Env, Variables } from '../types/hono';

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware to attach session helper methods
authRoutes.use('*', async (c, next) => {
  const session = (c.env.incoming as any).session;

  // Helper to get current user
  c.set('getUser', () => session?.user || null);

  // Helper to set user in session
  c.set('setUser', (user: any) => {
    session.user = user;
  });

  // Helper to destroy session
  c.set('logout', () => {
    return new Promise<void>((resolve, reject) => {
      session.destroy((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  await next();
});

// Login page
authRoutes.get('/login', async (c) => {
  // Check if already logged in
  const getUser = c.get('getUser') as () => any;
  const user = getUser();

  if (user) {
    return c.redirect('/');
  }

  // Render login page (EJS)
  const { renderEJS } = await import('../lib/render');
  return renderEJS(c, 'login', {});
});

// Login handler
authRoutes.post('/login/password', async (c) => {
  try {
    const body = await c.req.parseBody();
    const username = body.username as string;
    const password = body.password as string;

    if (!username || !password) {
      return c.redirect('/auth/login');
    }

    // Find user
    const user = getUserByUsername(username);

    if (!user) {
      return c.redirect('/auth/login');
    }

    // Verify password
    const hashedPassword = crypto.pbkdf2Sync(
      password,
      user.salt,
      310000,
      32,
      'sha256'
    );

    if (!crypto.timingSafeEqual(user.hashed_password, hashedPassword)) {
      return c.redirect('/auth/login');
    }

    // Set user in session
    const setUser = c.get('setUser') as (user: any) => void;
    setUser({
      id: user.id,
      username: user.username,
    });

    return c.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    return c.redirect('/auth/login');
  }
});

// Logout handler
authRoutes.post('/logout', async (c) => {
  try {
    const logout = c.get('logout') as () => Promise<void>;
    await logout();
  } catch (error) {
    console.error('Logout error:', error);
  }

  return c.redirect('/');
});
