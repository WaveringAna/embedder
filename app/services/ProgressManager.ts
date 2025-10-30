import { EventEmitter } from 'events';
import { cfg } from '../config';

export interface ProgressUpdate {
    filename: string;
    progress: number;
    status: 'processing' | 'complete' | 'error';
    message?: string;
}

class ProgressManager {
    private static instance: ProgressManager;
    private emitter: EventEmitter;
    private activeJobs: Map<string, ProgressUpdate>;
    private processVideo: boolean;

    private constructor() {
        this.emitter = new EventEmitter();
        this.activeJobs = new Map();
        this.processVideo = cfg.processVideo;
    }

    static getInstance(): ProgressManager {
        if (!ProgressManager.instance) {
            ProgressManager.instance = new ProgressManager();
        }
        return ProgressManager.instance;
    }

    updateProgress(update: ProgressUpdate) {
        if (!this.processVideo) return;

        this.activeJobs.set(update.filename, update);
        console.log(`[ProgressManager] Emitting progress update for ${update.filename}: ${update.status} ${(update.progress * 100).toFixed(2)}%`);
        this.emitter.emit('progress', update);

        // Clean up completed or errored jobs after a delay
        if (update.status === 'complete' || update.status === 'error') {
            setTimeout(() => {
                this.activeJobs.delete(update.filename);
                console.log(`[ProgressManager] Cleaned up job: ${update.filename}`);
            }, 60000); // Clean up after 1 minute
        }
    }

    subscribeToUpdates(callback: (update: ProgressUpdate) => void) {
        if (!this.processVideo) return;

        console.log(`[ProgressManager] New subscriber added. Total listeners: ${this.emitter.listenerCount('progress') + 1}`);
        this.emitter.on('progress', callback);
    }

    unsubscribeFromUpdates(callback: (update: ProgressUpdate) => void) {
        if (!this.processVideo) return;

        this.emitter.off('progress', callback);
        console.log(`[ProgressManager] Subscriber removed. Remaining listeners: ${this.emitter.listenerCount('progress')}`);
    }

    getActiveJobsCount(): number {
        return this.activeJobs.size;
    }

    getListenerCount(): number {
        return this.emitter.listenerCount('progress');
    }

    getJobStatus(filename: string): ProgressUpdate | undefined {
        if (!this.processVideo) return undefined;
        
        return this.activeJobs.get(filename);
    }
}

export const progressManager = ProgressManager.getInstance();
