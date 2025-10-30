import type { AppContext } from '../types/hono';
import ejs from 'ejs';
import path from 'path';
import { html } from 'hono/html';

const viewsDir = path.join(__dirname, '../views');

export async function renderEJS(c: AppContext, template: string, data: any = {}) {
  const templatePath = path.join(viewsDir, `${template}.ejs`);

  try {
    const rendered = await ejs.renderFile(templatePath, data, {
      cache: process.env.NODE_ENV === 'production',
    });

    return c.html(rendered);
  } catch (error) {
    console.error(`Error rendering template ${template}:`, error);
    throw error;
  }
}
