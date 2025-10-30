import { MEDIA_TYPES, MediaType } from '../types';

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
};

export const getMediaType = (filename: string): MediaType => {
  const ext = getFileExtension(filename);
  if (MEDIA_TYPES.video.includes(ext)) return 'video';
  if (MEDIA_TYPES.image.includes(ext)) return 'image';
  return 'other';
};

export const sanitizeId = (filename: string): string => {
  return filename.replace(/[^a-z0-9]/gi, '_');
};

export const absolutePath = (href: string): string => {
  const link = document.createElement('a');
  link.href = href;
  return link.href;
};

export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Copied to clipboard');
  } catch (err) {
    console.error('Copy failed:', err);
  }
};
