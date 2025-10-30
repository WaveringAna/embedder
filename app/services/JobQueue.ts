import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { progressManager } from './ProgressManager';
import { ffmpegDownscale } from '../lib/ffmpeg';
import path from 'path';

/**
 * Redis connection
 */
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

/**
 * Job data interface
 */
export interface VideoProcessingJob {
  filename: string;
  username: string;
  uploadPath: string;
}

/**
 * Create the video processing queue
 */
export const videoQueue = new Queue<VideoProcessingJob>('video-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});

/**
 * Create the worker to process video jobs
 */
export const videoWorker = new Worker<VideoProcessingJob>(
  'video-processing',
  async (job: Job<VideoProcessingJob>) => {
    const { filename, uploadPath } = job.data;

    console.log(`[JobQueue] Processing video: ${filename}`);

    // Update progress to processing
    progressManager.updateProgress({
      filename,
      progress: 0,
      status: 'processing',
      message: 'Starting video processing...',
    });

    try {
      // Extract filename and extension
      const filenameParts = filename.split('.');
      const extension = `.${filenameParts.pop()}`;
      const filenameWithoutExt = filenameParts.join('.');

      // Process video with FFmpeg
      await ffmpegDownscale(
        uploadPath,
        filenameWithoutExt,
        extension,
        (progress: number) => {
          // Update job progress
          job.updateProgress(progress * 100);

          // Update SSE progress
          progressManager.updateProgress({
            filename,
            progress,
            status: 'processing',
          });
        }
      );

      // Mark as complete
      progressManager.updateProgress({
        filename,
        progress: 1,
        status: 'complete',
        message: 'Video processing complete',
      });

      console.log(`[JobQueue] Completed processing: ${filename}`);

      return { success: true, filename };
    } catch (error) {
      console.error(`[JobQueue] Error processing ${filename}:`, error);

      // Update progress with error
      progressManager.updateProgress({
        filename,
        progress: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.EB_FFMPEG_CONCURRENCY || '1'),
    limiter: {
      max: parseInt(process.env.EB_FFMPEG_CONCURRENCY || '1'),
      duration: 1000,
    },
  }
);

/**
 * Worker event handlers
 */
videoWorker.on('completed', (job) => {
  console.log(`[JobQueue] Job ${job.id} completed`);
});

videoWorker.on('failed', (job, err) => {
  console.error(`[JobQueue] Job ${job?.id} failed:`, err.message);
});

videoWorker.on('error', (err) => {
  console.error('[JobQueue] Worker error:', err);
});

/**
 * Queue event handlers
 */
videoQueue.on('error', (err) => {
  console.error('[JobQueue] Queue error:', err);
});

/**
 * Add a video processing job
 */
export async function addVideoProcessingJob(
  filename: string,
  username: string,
  uploadPath: string
): Promise<Job<VideoProcessingJob>> {
  console.log(`[JobQueue] Adding video processing job for: ${filename}`);

  const job = await videoQueue.add(
    'process-video',
    {
      filename,
      username,
      uploadPath,
    },
    {
      jobId: `video-${filename}-${Date.now()}`,
    }
  );

  return job;
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    videoQueue.getWaitingCount(),
    videoQueue.getActiveCount(),
    videoQueue.getCompletedCount(),
    videoQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
  };
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('[JobQueue] Shutting down...');
  await videoWorker.close();
  await videoQueue.close();
  await connection.quit();
  console.log('[JobQueue] Shutdown complete');
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
