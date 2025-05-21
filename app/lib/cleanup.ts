import * as fsPromises from 'fs/promises';
import path from 'path';

const TMP_UPLOAD_DIR = path.join('uploads', 'tmp');
const DEFAULT_MAX_AGE_HOURS = 24; // Default to 24 hours

/**
 * Cleans up orphaned chunk directories from the temporary upload directory.
 * Orphaned chunks are directories that haven't been modified for a certain period.
 *
 * @param maxAgeInHours - The maximum age in hours for a directory to be considered orphaned.
 *                        Defaults to DEFAULT_MAX_AGE_HOURS.
 */
export async function cleanupOrphanedChunks(maxAgeInHours: number = DEFAULT_MAX_AGE_HOURS): Promise<void> {
    console.log(`[CLEANUP_SERVICE] Starting orphaned chunk cleanup. Max age: ${maxAgeInHours} hours.`);
    const now = Date.now();
    const maxAgeInMillis = maxAgeInHours * 60 * 60 * 1000;

    try {
        // Ensure the temporary directory exists
        try {
            await fsPromises.access(TMP_UPLOAD_DIR);
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                console.log(`[CLEANUP_SERVICE] Temporary upload directory ${TMP_UPLOAD_DIR} does not exist. Nothing to clean.`);
                return;
            }
            throw e; // Other access errors
        }

        const entries = await fsPromises.readdir(TMP_UPLOAD_DIR, { withFileTypes: true });
        let cleanedCount = 0;
        let errorCount = 0;

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const dirPath = path.join(TMP_UPLOAD_DIR, entry.name);
                try {
                    const stats = await fsPromises.stat(dirPath);
                    const dirAgeInMillis = now - stats.mtime.getTime();

                    if (dirAgeInMillis > maxAgeInMillis) {
                        console.log(`[CLEANUP_SERVICE] Deleting orphaned directory: ${dirPath} (age: ${Math.round(dirAgeInMillis / (60 * 60 * 1000))} hours)`);
                        await fsPromises.rm(dirPath, { recursive: true, force: true });
                        cleanedCount++;
                    }
                } catch (statError: any) {
                    // If we can't stat the directory, it might have been deleted by another process, or permissions issue.
                    console.error(`[CLEANUP_SERVICE_ERROR] Error stating directory ${dirPath}: ${statError.message}. Skipping.`);
                    errorCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`[CLEANUP_SERVICE] Successfully deleted ${cleanedCount} orphaned chunk director(ies).`);
        } else {
            console.log('[CLEANUP_SERVICE] No orphaned chunk directories found to delete.');
        }
        if (errorCount > 0) {
            console.warn(`[CLEANUP_SERVICE] Encountered ${errorCount} errors during stat/delete operations.`);
        }
        console.log('[CLEANUP_SERVICE] Orphaned chunk cleanup finished.');

    } catch (error: any) {
        console.error(`[CLEANUP_SERVICE_FATAL] Error during cleanup process: ${error.message}`, error);
    }
}

// Example of how it might be called (e.g., from a scheduler, not part of this subtask to implement the scheduler)
// (async () => {
//   await cleanupOrphanedChunks(48); // Clean up anything older than 48 hours
// })();
