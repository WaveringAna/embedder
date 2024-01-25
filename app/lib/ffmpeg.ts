import { videoExtensions, imageExtensions } from "./lib";

import ffmpeg, { FfprobeData, ffprobe } from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import which from "which";

import fs from "fs";

/**
 * Enum to represent different types of video encoding methods.
 *
 * @enum {string}
 * @property {string} CPU - Uses the libx264 codec for CPU-based encoding
 * @property {string} NVIDIA - Uses the h264_nvenc codec for NVIDIA GPU-based encoding
 * @property {string} AMD - Uses the h264_amf codec for AMD GPU-based encoding
 * @property {string} INTEL - Uses the h264_qsv codec for Intel GPU-based encoding
 * @property {string} APPLE - Uses the h264_videotoolbox codec for Apple GPU/MediaEngine-based encoding
 */
export enum EncodingType {
  CPU = "libx264",
  NVIDIA = "h264_nvenc",
  AMD = "h264_amf",
  INTEL = "h264_qsv",
  APPLE = "h264_videotoolbox",
}

/**
 * The current encoding type being used for video encoding. Default is CPU
 * @type {EncodingType}
 */
export let currentEncoding: EncodingType = EncodingType.CPU;

/**
 * Sets the current encoding type.
 *
 * @param {EncodingType} type - The encoding type to set.
 */
export const setEncodingType = (type: EncodingType) => {
    currentEncoding = type;
};

/**
 * Returns the path to an executable by checking environment variables, the system path, or a default installer.
 *
 * @param {string} envVar - The environment variable to check for the executable's path.
 * @param {string} executable - The name of the executable to search for in the system path.
 * @param {Object} installer - An object containing the default installer path.
 * @param {string} installer.path - The default path to use if the executable is not found in the environment or system path.
 *
 * @returns {string} - The path to the executable.
 * @throws Will throw an error if the executable is not found and the installer path is not available.
 */
const getExecutablePath = (
    envVar: string,
    executable: string,
    installer: { path: string },
): string => {
    if (process.env[envVar]) {
        return process.env[envVar];
    }

    try {
        return which.sync(executable);
    } catch (error) {
        return installer.path;
    }
};

const ffmpegPath = getExecutablePath(
    "EB_FFMPEG_PATH",
    "ffmpeg",
    ffmpegInstaller,
);

const ffprobePath = getExecutablePath(
    "EB_FFPROBE_PATH",
    "ffprobe",
    ffprobeInstaller,
);

console.log(`Using ffmpeg from path: ${ffmpegPath}`);
console.log(`Using ffprobe from path: ${ffprobePath}`);

ffmpeg.setFfmpegPath(ffmpegPath!);
ffmpeg.setFfprobePath(ffprobePath!);

const checkEnvForEncoder = () => {
    const envEncoder = process.env.EB_ENCODER?.toUpperCase();

    if (envEncoder && Object.keys(EncodingType).includes(envEncoder)) {
        setEncodingType(
      EncodingType[envEncoder as keyof typeof EncodingType] as EncodingType,
        );
        console.log(
            `Setting encoding type to ${envEncoder} based on environment variable.`,
        );
    } else if (envEncoder) {
        console.warn(
            `Invalid encoder value "${envEncoder}" in environment variable, defaulting to CPU.`,
        );
    }
};

checkEnvForEncoder();

/**
 * Downscale a video using ffmpeg with various encoding options.
 *
 * @param {string} path - The input video file path.
 * @param {string} filename - The name of the file.
 * @param {string} extension - The file extension of the file
 * @returns {Promise<void>} - A promise that resolves when the downscaling is complete, and rejects on error.
 *
 * @example
 * ffmpegDownscale('input.mp4').then(() => {
 *   console.log('Downscaling complete.');
 * }).catch((error) => {
 *   console.log(`Error: ${error}`);
 * });
 */
export const ffmpegDownscale = (
    path: string,
    filename: string,
    extension: string,
): Promise<void> => {
    const startTime = Date.now();
    const outputOptions = [
        "-vf",
        "scale=-2:720",
        "-c:v",
        currentEncoding,
        "-c:a",
        "copy",
        "-pix_fmt",
        "yuv420p",
    ];

    return new Promise<void>((resolve, reject) => {
        const progressFile = `uploads/${filename}${extension}-progress.json`;

        ffmpeg()
            .input(path)
            .outputOptions(outputOptions)
            .output(`uploads/720p-${filename}${extension}`)
            .on("progress", function (progress) {
                fs.writeFileSync(
                    progressFile,
                    JSON.stringify({ progress: progress.percent / 100 }),
                );
            })
            .on("end", () => {
                console.log(
                    `720p copy complete using ${currentEncoding}, took ${
                        Date.now() - startTime
                    }ms to complete`,
                );

                // Delete the .processing file
                fs.unlinkSync(progressFile);

                resolve();
            })
            .on("error", (e) => {
                // Ensure to delete the .processing file even on error
                if (fs.existsSync(progressFile)) {
                    fs.unlinkSync(progressFile);
                }

                reject(new Error(e));
            })
            .run();
    });
};

/**
 * Convert a video to a gif or vice versa using ffmpeg with various encoding options.
 *
 * @param {string} path - The input video file path.
 * @param {string} filename - The name of the file.
 * @param {string} extension - The file extension of the file
 * @returns {Promise<void>} - A promise that resolves when the conversion is complete, and rejects on error.
 *
 * @example
 * ffmpegConvert('input.mp4').then(() => {
 *   console.log('Conversion complete.');
 * }).catch((error) => {
 *   console.log(`Error: ${error}`);
 * });
 */
export const ffmpegConvert = (
    path: string,
    filename: string,
    extension: string,
): Promise<void> => {
    const startTime = Date.now();
    const outputOptions = [
        "-vf",
        "scale=-2:720",
        "-c:v",
        currentEncoding,
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
    ];

    let outputFormat: string;

    if (videoExtensions.includes(extension)) {
        outputFormat = ".gif";
    } else if (extension == ".gif") {
        outputFormat = ".mp4";
    } else {
        return new Promise<void>((resolve, reject) => {
            reject(`Submitted file is neither a video nor a gif: ${path}`);
        });
    }

    return new Promise<void>((resolve, reject) => {
        const progressFile = `uploads/${filename}${extension}-progress.json`;

        ffmpeg()
            .input(path)
            .outputOptions(outputOptions)
            .output("uploads/")
            .outputFormat(outputFormat)
            .output(`uploads/${filename}${outputFormat}`)
            .on("progress", function (progress) {
                fs.writeFileSync(
                    progressFile,
                    JSON.stringify({ progress: progress.percent / 100 }),
                );
            })
            .on("end", function () {
                console.log(
                    `Conversion complete, took ${Date.now() - startTime} to complete`,
                );
                console.log(`uploads/${filename}${outputFormat}`);
                resolve();
            })
            .on("error", (e) => reject(e))
            .run();
    });
};

export const ffProbe = async (
    path: string,
    filename: string,
    extension: string,
) => {
    return new Promise<FfprobeData>((resolve, reject) => {
        if (
            !videoExtensions.includes(extension) &&
      !imageExtensions.includes(extension)
        ) {
            console.log(`Extension is ${extension}`);
            reject(`Submitted file is neither a video nor an image: ${path}`);
        }

        ffprobe(path, (err, data) => {
            if (err) reject(err);
            resolve(data);
        });
    });
};
