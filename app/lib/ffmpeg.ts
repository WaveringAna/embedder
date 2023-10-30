import { extension, videoExtensions, imageExtensions } from "./lib";

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import which from 'which';

/**
 * Enum to represent different types of video encoding methods.
 * 
 * @enum {string}
 * @property {string} CPU - Uses the libx264 codec for CPU-based encoding
 * @property {string} NVIDIA - Uses the h264_nvenc codec for NVIDIA GPU-based encoding
 * @property {string} AMD - Uses the h264_amf codec for AMD GPU-based encoding
 * @property {string} INTEL - Uses the h264_qsv codec for Intel GPU-based encoding
 * @property {string} APPLE - Uses the h264_videotoolbox codec for Apple GPU-based encoding
 */
export enum EncodingType {
    CPU = 'libx264',
    NVIDIA = 'h264_nvenc',
    AMD = 'h264_amf',
    INTEL = 'h264_qsv',
    APPLE = 'h264_videotoolbox'
}

/**
 * The current encoding type being used for video encoding.
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
const getExecutablePath = (envVar: string, executable: string, installer: { path: string }) => {
    if (process.env[envVar]) {
        return process.env[envVar];
    }

    try {
        return which.sync(executable);
    } catch (error) {
        return installer.path;
    }
};

const ffmpegPath = getExecutablePath('EB_FFMPEG_PATH', 'ffmpeg', ffmpegInstaller);
const ffprobePath = getExecutablePath('EB_FFPROBE_PATH', 'ffprobe', ffprobeInstaller);

console.log(`Using ffmpeg from path: ${ffmpegPath}`);
console.log(`Using ffprobe from path: ${ffprobePath}`);

ffmpeg.setFfmpegPath(ffmpegPath!);
ffmpeg.setFfprobePath(ffprobePath!);

const checkEnvForEncoder = () => {
    const envEncoder = process.env.EB_ENCODER?.toUpperCase();

    if (envEncoder && Object.keys(EncodingType).includes(envEncoder)) {
        setEncodingType(EncodingType[envEncoder as keyof typeof EncodingType] as EncodingType);
        console.log(`Setting encoding type to ${envEncoder} based on environment variable.`);
    } else if (envEncoder) {
        console.warn(`Invalid encoder value "${envEncoder}" in environment variable, defaulting to CPU.`);
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
export const ffmpegDownscale = (path: string, filename: string, extension: string) => {
    const startTime = Date.now();
    const outputOptions = [
        '-vf', 'scale=-2:720',
        '-c:v', currentEncoding,
        '-c:a', 'copy',
    ];

    // Adjust output options based on encoder for maximum quality
    switch (currentEncoding) {
        case EncodingType.CPU:
            outputOptions.push('-crf', '0');
            break;
        case EncodingType.NVIDIA:
            outputOptions.push('-rc', 'cqp', '-qp', '0');
            break;
        case EncodingType.AMD:
            outputOptions.push('-qp_i', '0', '-qp_p', '0', '-qp_b', '0');
            break;
        case EncodingType.INTEL:
            outputOptions.push('-global_quality', '1'); // Intel QSV specific setting for high quality
            break;
        case EncodingType.APPLE:
            outputOptions.push('-global_quality', '1');
            break;
    }

    return new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(path)
            .outputOptions(outputOptions)
            .output(`uploads/720p-${filename}${extension}`)
            .on('end', () => {
                console.log(`720p copy complete using ${currentEncoding}, took ${Date.now() - startTime}ms to complete`);
                resolve();
            })
            .on('error', (e) => reject(new Error(e)))
            .run();
    });
}

/** Converts video to gif and vice versa using ffmpeg */
/**export const convert: Middleware = (req, res, next)  => {
  const files = req.files as Express.Multer.File[];

  for (const file in files) {
    const nameAndExtension = extension(files[file].originalname);

    if (videoExtensions.includes(nameAndExtension[1])) {
      console.log("Converting " + nameAndExtension[0] + nameAndExtension[1] + " to gif");
      console.log(`Using ${currentEncoding} as encoder`);
      const startTime = Date.now();
      ffmpeg()
        .input(`uploads/${nameAndExtension[0]}${nameAndExtension[1]}`)
        .inputFormat(nameAndExtension[1].substring(1))
        .outputOptions(`-c:v ${currentEncoding}`)
        .outputFormat("gif")
        .output(`uploads/${nameAndExtension[0]}.gif`)
        .on("end", function() {
          console.log(`Conversion complete, took ${Date.now() - startTime} to complete`);
          console.log(`Uploaded to uploads/${nameAndExtension[0]}.gif`);
        })
        .on("error", (e) => console.log(e))
        .run();
    } else if (nameAndExtension[1] == ".gif") {
      console.log(`Converting ${nameAndExtension[0]}${nameAndExtension[1]} to mp4`);
      console.log(`Using ${currentEncoding} as encoder`);

      const startTime = Date.now();
      ffmpeg(`uploads/${nameAndExtension[0]}${nameAndExtension[1]}`)
        .inputFormat("gif")
        .outputFormat("mp4")
        .outputOptions([
          "-pix_fmt yuv420p",
          `-c:v ${currentEncoding}`,
          "-movflags +faststart"
        ])
        .noAudio()
        .output(`uploads/${nameAndExtension[0]}.mp4`)
        .on("end", function() {
          console.log(`Conversion complete, took ${Date.now() - startTime} to complete`);
          console.log(`Uploaded to uploads/${nameAndExtension[0]}.mp4`);
          next();
        })
        .run();
    }
  }
};**/