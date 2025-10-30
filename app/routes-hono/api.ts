import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { cfg } from '../config';
import { fileStorage } from '../lib/multer';
import * as db from '../lib/db-new';
import { extension, videoExtensions } from '../lib/lib';
import { addVideoProcessingJob } from '../services/JobQueue';
import type { Env, Variables } from '../types/hono';

export const apiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const upload = multer({ storage: fileStorage });

// Auth middleware
const requireAuth = async (c: any, next: any) => {
  const session = (c.env.incoming as any).session;
  const user = session?.user;

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  c.set('user', user);
  await next();
};

// Get config
apiRoutes.get('/config', async (c) => {
  const session = (c.env.incoming as any).session;
  const user = session?.user;

  if (!user) {
    return c.json({
      authenticated: false,
      error: 'Not authenticated',
    }, 401);
  }

  return c.json({
    authenticated: true,
    user: {
      username: user.username,
    },
    processVideo: cfg.processVideo,
  });
});

// Get media list
apiRoutes.get('/media-list', requireAuth, async (c) => {
  const user = c.get('user');
  const isAdmin = user.username === 'admin';

  try {
    const media = isAdmin ? db.getAllMedia() : db.getMediaByUsername(user.username);

    // Check if processed
    const files = await Promise.all(
      media.map(async (row) => {
        let isProcessed = true;

        if (videoExtensions.includes(extension(row.path)[1])) {
          try {
            await fs.access(`uploads/720p-${row.path}`);
            isProcessed = true;
          } catch {
            isProcessed = false;
          }
        }

        return {
          id: row.id,
          path: row.path,
          expire: row.expire,
          username: row.username,
          url: `/${row.id}`,
          isProcessed,
        };
      })
    );

    return c.json({
      files: files.reverse(),
      count: files.length,
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    return c.json({ error: 'Database error' }, 500);
  }
});

// Upload file (using multer middleware via custom adapter)
apiRoutes.post('/upload', requireAuth, async (c) => {
  try {
    const user = c.get('user');

    // Parse multipart form data with multer
    await new Promise<void>((resolve, reject) => {
      const middleware = upload.array('fileupload');
      middleware(c.env.incoming as any, c.env.outgoing as any, (err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const files = (c.env.incoming as any).files as Express.Multer.File[];
    const body = (c.env.incoming as any).body;

    if (!files || files.length === 0) {
      return c.json({ error: 'No files uploaded' }, 400);
    }

    // Process expiration
    const expireDays = parseFloat(body.expire || '0');
    const expireDate =
      expireDays > 0 ? Date.now() + expireDays * 24 * 60 * 60 * 1000 : null;

    // Insert files into database and queue video processing
    for (const file of files) {
      const mediaId = db.insertMedia(file.filename, expireDate, user.username);

      // Check if it's a video that needs processing
      const [filename, ext] = extension(file.filename);

      if (cfg.processVideo && videoExtensions.includes(ext)) {
        console.log(`[API] Queueing video processing for: ${file.filename}`);

        await addVideoProcessingJob(file.filename, user.username, file.path);
      }

      // Create oEmbed data (async, don't wait)
      (async () => {
        try {
          const [filename, fileExtension] = extension(file.filename);
          const host = c.req.header('host') || 'localhost:3000';
          const protocol = c.req.header('x-forwarded-proto') || 'http';
          
          const oembed = {
            type: videoExtensions.includes(fileExtension) ? "video" : "photo",
            version: "1.0",
            provider_name: "embedder",
            provider_url: "https://github.com/WaveringAna/embedder",
            cache_age: 86400,
            html: `<iframe src='${protocol}://${host}/gifv/${filename}${fileExtension}'></iframe>`,
            title: filename,
            url: `${protocol}://${host}/uploads/${filename}${fileExtension}`,
          };

          await fs.writeFile(
            `uploads/oembed-${filename}${fileExtension}.json`,
            JSON.stringify(oembed)
          );
          console.log(`oembed file created ${filename}${fileExtension}.json`);
        } catch (error) {
          console.error('Error creating oembed:', error);
        }
      })();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

// Delete media
apiRoutes.delete('/:id/delete', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({ error: 'Invalid ID' }, 400);
    }

    // Get file info
    const media = db.getMediaById(id);

    if (!media) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Check ownership (unless admin)
    if (user.username !== 'admin' && media.username !== user.username) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Delete files
    const filePath = path.join(__dirname, '../../uploads', media.path);
    const oembedPath = path.join(
      __dirname,
      '../../uploads',
      `oembed-${media.path}.json`
    );
    const [filename, ext] = extension(filePath);
    const processedPath = path.join(
      __dirname,
      '../../uploads',
      `720p-${media.path}`
    );

    const filesToDelete = [filePath, oembedPath];

    if (videoExtensions.includes(ext) || ext === '.gif') {
      filesToDelete.push(processedPath);
    }

    // Delete files (ignore errors if file doesn't exist)
    await Promise.allSettled(
      filesToDelete.map((path) =>
        fs.unlink(path).catch(() => console.log(`File not found: ${path}`))
      )
    );

    // Delete from database
    db.deleteMedia(id);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: 'Delete failed' }, 500);
  }
});
