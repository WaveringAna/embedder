import { EventEmitter } from 'events';

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

    private constructor() {
        this.emitter = new EventEmitter();
        this.activeJobs = new Map();
    }

    static getInstance(): ProgressManager {
        if (!ProgressManager.instance) {
            ProgressManager.instance = new ProgressManager();
        }
        return ProgressManager.instance;
    }

    updateProgress(update: ProgressUpdate) {
        this.activeJobs.set(update.filename, update);
        this.emitter.emit('progress', update);
    }

    subscribeToUpdates(callback: (update: ProgressUpdate) => void) {
        this.emitter.on('progress', callback);
    }

    unsubscribeFromUpdates(callback: (update: ProgressUpdate) => void) {
        this.emitter.off('progress', callback);
    }

    getJobStatus(filename: string): ProgressUpdate | undefined {
        return this.activeJobs.get(filename);
    }
}

export const progressManager = ProgressManager.getInstance();
