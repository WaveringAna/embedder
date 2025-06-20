// Keep this file dependency-free to avoid circular imports

/**
 * Centralised, typed application configuration.
 * Reads environment variables once at startup and exposes
 * values for other modules to import.
 */
export const cfg = {
    /** Whether to run server-side video processing */
    processVideo: process.env.EB_PROCESS_VIDEO !== "false",

    /** Desired video encoder (defaults to CPU) */
    encoder: (process.env.EB_ENCODER ?? "CPU").toUpperCase(),

    /** Override paths to ffmpeg / ffprobe binaries */
    ffmpegPath: process.env.EB_FFMPEG_PATH,
    ffprobePath: process.env.EB_FFPROBE_PATH,

    /** API key expected for ShareX or similar clients */
    apiKey: process.env.EBAPI_KEY || process.env.EBPASS || "pleaseSetAPI_KEY",

    /** Directory on disk where uploaded files are stored */
    uploadDir: process.env.EB_UPLOAD_DIR || "uploads",

    /** Maximum number of ffmpeg processes to run in parallel */
    ffmpegConcurrency: parseInt(process.env.EB_FFMPEG_CONCURRENCY || "1", 10)
} as const; 