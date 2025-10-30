import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import imageProbe from 'probe-image-size';
import { ffProbe } from '../lib/ffmpeg';
import { extension, videoExtensions, oembedObj } from '../lib/lib';
import { renderEJS } from '../lib/render';
import { cfg } from '../config';
import type { Env, Variables } from '../types/hono';

export const mediaRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Home page
mediaRoutes.get('/', async (c) => {
  const session = (c.env.incoming as any).session;
  const user = session?.user;

  if (!user) {
    return renderEJS(c, 'home', {});
  }

  // Serve React app for authenticated users
  const reactAppPath = path.join(__dirname, '../../dist/client/index.html');
  const html = fs.readFileSync(reactAppPath, 'utf-8');
  return c.html(html);
});

// GIFv viewer
mediaRoutes.get('/gifv/:file', async (c) => {
  const filename = c.req.param('file');
  const url = `${c.req.url.split('/gifv')[0]}/uploads/${filename}`;
  const host = `${c.req.url.split('/gifv')[0]}`;

  const [name, fileExtension] = extension(`uploads/${filename}`);

  let width = 800;
  let height = 600;

  try {
    if (videoExtensions.includes(fileExtension)) {
      const imageData = await ffProbe(`uploads/${filename}`, name, fileExtension);
      width = imageData.streams[0].width || 800;
      height = imageData.streams[0].height || 600;
    } else {
      const imageData = await imageProbe(fs.createReadStream(`uploads/${filename}`));
      width = imageData.width;
      height = imageData.height;
    }
  } catch (error) {
    console.error('Error processing media:', error);
  }

  return renderEJS(c, 'gifv', {
    url,
    host,
    width,
    height,
  });
});

// oEmbed endpoint
mediaRoutes.get('/oembed/:file', async (c) => {
  const filename = c.req.param('file');
  const fileExtension = filename.slice(filename.lastIndexOf('.'));
  const host = c.req.url.split('/oembed')[0];

  try {
    const oembedData: oembedObj = {
      type: videoExtensions.includes(fileExtension) ? 'video' : 'photo',
      version: '1.0',
      provider_name: 'embedder',
      provider_url: 'https://github.com/WaveringAna/embedder',
      cache_age: 86400,
      title: filename.slice(0, filename.lastIndexOf('.')),
      html: '',
      url: `${host}/uploads/${filename}`,
    };

    if (videoExtensions.includes(fileExtension) || fileExtension === '.gif') {
      const ffprobeData = await ffProbe(`uploads/${filename}`, filename, fileExtension);
      oembedData.width = ffprobeData.streams[0].width;
      oembedData.height = ffprobeData.streams[0].height;
      oembedData.html = `<video width="${oembedData.width}" height="${oembedData.height}" controls><source src="${oembedData.url}" type="video/${fileExtension.substring(1)}">Your browser does not support the video tag.</video>`;
    } else {
      const imageData = await imageProbe(fs.createReadStream(`uploads/${filename}`));
      oembedData.width = imageData.width;
      oembedData.height = imageData.height;
      oembedData.html = `<img src="${oembedData.url}" width="${oembedData.width}" height="${oembedData.height}" alt="${filename}">`;
    }

    return c.json(oembedData);
  } catch (error) {
    console.error('Error generating oEmbed data:', error);
    return c.json({ error: 'Error generating oEmbed data' }, 500);
  }
});

// ShareX upload endpoint
mediaRoutes.post('/sharex', async (c) => {
  // TODO: Implement ShareX upload
  return c.json({ error: 'Not implemented yet' }, 501);
});
