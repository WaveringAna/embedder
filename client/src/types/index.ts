export interface User {
  username: string;
}

export interface MediaFile {
  id: number;
  path: string;
  expire: number | null;
  username: string;
  url: string;
  isProcessed: boolean;
}

export interface ProgressUpdate {
  filename: string;
  progress: number;
  status: 'processing' | 'complete' | 'error';
  message?: string;
}

export const MEDIA_TYPES = {
  video: ['.mp4', '.mov', '.avi', '.flv', '.mkv', '.wmv', '.webm'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.tiff', '.webp']
};

export type MediaType = 'video' | 'image' | 'other';
