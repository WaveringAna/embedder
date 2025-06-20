import ffmpeg from 'fluent-ffmpeg';
import { progressManager } from './ProgressManager';
import { currentEncoding } from '../lib/ffmpeg';
import { cfg } from '../config';

// Simple in-memory job queue to limit concurrent ffmpeg processes
class FfmpegQueue {
    private active = 0;
    private readonly concurrency = cfg.ffmpegConcurrency;
    private readonly queue: Array<() => void> = [];

    enqueue<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const run = () => {
                this.active++;
                task().then(resolve).catch(reject).finally(() => {
                    this.active--;
                    const next = this.queue.shift();
                    if (next) next();
                });
            };

            if (this.active < this.concurrency) {
                run();
            } else {
                this.queue.push(run);
            }
        });
    }
}

const ffmpegQueue = new FfmpegQueue();

export class MediaProcessor {
    static async processVideo(
        inputPath: string,
        filename: string,
        extension: string
    ): Promise<void> {
        return ffmpegQueue.enqueue(() => new Promise<void>((resolve, reject) => {
            console.log("Starting video processing:", filename);

            const outputPath = `uploads/720p-${filename}${extension}`;
            const outputOptions = [
                '-vf', 'scale=-2:720',
                '-c:v', currentEncoding,
                '-c:a', 'copy',
                '-pix_fmt', 'yuv420p'
            ];

            ffmpeg()
                .input(inputPath)
                .outputOptions(outputOptions)
                .output(outputPath)
                .on('progress', (progress) => {
                    progressManager.updateProgress({
                        filename: `${filename}${extension}`,
                        progress: progress.percent ? progress.percent / 100 : 0,
                        status: 'processing'
                    });
                })
                .on('end', () => {
                    console.log("Processing complete:", filename);
                    progressManager.updateProgress({
                        filename: `${filename}${extension}`,
                        progress: 1,
                        status: 'complete'
                    });
                    resolve();
                })
                .on('error', (err) => {
                    console.error("Processing error:", err);
                    progressManager.updateProgress({
                        filename: `${filename}${extension}`,
                        progress: 0,
                        status: 'error',
                        message: err.message
                    });
                    reject(err);
                })
                .run();
        }));
    }
}