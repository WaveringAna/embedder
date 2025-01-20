import ffmpeg from 'fluent-ffmpeg';
import { progressManager } from './ProgressManager';
import { EncodingType, currentEncoding } from '../lib/ffmpeg';

export class MediaProcessor {
    static async processVideo(
        inputPath: string,
        filename: string,
        extension: string
    ): Promise<void> {
        console.log("Starting video processing:", filename);  // Debug log

        const outputPath = `uploads/720p-${filename}${extension}`;
        const outputOptions = [
            '-vf', 'scale=-2:720',
            '-c:v', currentEncoding,
            '-c:a', 'copy',
            '-pix_fmt', 'yuv420p'
        ];

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(inputPath)
                .outputOptions(outputOptions)
                .output(outputPath)
                .on('progress', (progress) => {
                    console.log("Progress:", progress.percent);  // Debug log
                    progressManager.updateProgress({
                        filename: `${filename}${extension}`,
                        progress: progress.percent / 100,
                        status: 'processing'
                    });
                })
                .on('end', () => {
                    console.log("Processing complete:", filename);  // Debug log
                    progressManager.updateProgress({
                        filename: `${filename}${extension}`,
                        progress: 1,
                        status: 'complete'
                    });
                    resolve();
                })
                .on('error', (err) => {
                    console.error("Processing error:", err);  // Debug log
                    progressManager.updateProgress({
                        filename: `${filename}${extension}`,
                        progress: 0,
                        status: 'error',
                        message: err.message
                    });
                    reject(err);
                })
                .run();
        });
    }
}