import type {RequestHandler as Middleware, NextFunction} from "express";

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import which from 'which';

//weird error that occurs where if I use the alias 'process', node cannot access it
import Process from 'node:process';

const getExecutablePath = (envVar: string, executable: string, installer: { path: string }) => {
  if (Process.env[envVar]) {
    return Process.env[envVar];
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

import fs from "fs";
import process from "process";

import {extension, videoExtensions, imageExtensions} from "./lib";
import {db, MediaParams, insertToDB} from "./db";

enum EncodingType {
  CPU = 'libx264',
  NVIDIA = 'h264_nvenc',
  AMD = 'h264_amf',
  INTEL = 'h264_qsv',
  APPLE = 'h264_videotoolbox'
}

let currentEncoding: EncodingType = EncodingType.CPU;

export const setEncodingType = (type: EncodingType) => {
  currentEncoding = type;
};

export const checkEnvForEncoder = () => {
  const envEncoder = process.env.EB_ENCODER?.toUpperCase();

  if (envEncoder && Object.keys(EncodingType).includes(envEncoder)) {
    setEncodingType(EncodingType[envEncoder as keyof typeof EncodingType] as EncodingType);
    console.log(`Setting encoding type to ${envEncoder} based on environment variable.`);
  } else if (envEncoder) {
    //I finally understand DHH
    console.warn(`Invalid encoder value "${envEncoder}" in environment variable, defaulting to ${Object.keys(EncodingType).find(key => EncodingType[key as keyof typeof EncodingType] === currentEncoding)}.`);
  }
};

checkEnvForEncoder();

export const checkAuth: Middleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401);
  }
  next();
};

/**Checks shareX auth key */
export const checkSharexAuth: Middleware = (req, res, next) => {
  const auth = process.env.EBAPI_KEY || process.env.EBPASS || "pleaseSetAPI_KEY";
  let key = null;
  
  if (req.headers["key"]) {
    key = req.headers["key"];
  } else {
    return res.status(400).send("{success: false, message: \"No key provided\", fix: \"Provide a key\"}");
  }
  
  if (auth != key) {
    return res.status(401).send("{success: false, message: '\"'Invalid key\", fix: \"Provide a valid key\"}");
  }
  
  const shortKey = key.substr(0, 3) + "..."; 
  console.log(`Authenicated user with key: ${shortKey}`);
  
  next();
};

/**Creates oembed json file for embed metadata */
export const createEmbedData: Middleware = (req, res, next) => {
  const files = req.files as Express.Multer.File[];
  for (const file in files) {
    const nameAndExtension = extension(files[file].originalname);
    const oembed = {
      type: "video",
      version: "1.0",
      provider_name: "embedder",
      provider_url: "https://github.com/WaveringAna/embedder",
      cache_age: 86400,
      html: `<iframe src='${req.protocol}://${req.get("host")}/gifv/${nameAndExtension[0]}${nameAndExtension[1]}'></iframe>`,
      width: 640,
      height: 360
    };
  
    fs.writeFile(`uploads/oembed-${nameAndExtension[0]}${nameAndExtension[1]}.json`, JSON.stringify(oembed), function (err) {
      if (err) return next(err);
      console.log(`oembed file created ${nameAndExtension[0]}${nameAndExtension[1]}.json`);
    });
  }
  next();
};

/** Converts video to gif and vice versa using ffmpeg */
export const convert: Middleware = (req, res, next)  => {
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
};

/**Creates a 720p copy of video for smaller file */
export const convertTo720p: Middleware = (req, res, next) => {
  const files = req.files as Express.Multer.File[];
  console.log("convert to 720p running");
  for (const file in files) {
    const nameAndExtension = extension(files[file].originalname);

    //Skip if not a video
    if (!videoExtensions.includes(nameAndExtension[1]) && nameAndExtension[1] !== ".gif") {
      console.log(`${files[file].originalname} is not a video file`);
      console.log(nameAndExtension[1]);
      continue;
    }

    console.log(`Creating 720p for ${files[file].originalname}`);

    const startTime = Date.now();

    const outputOptions = [
      '-vf', 'scale=-2:720',
      '-c:v', currentEncoding,
    ];

    // Adjust output options based on encoder for maximum quality
    switch(currentEncoding) {
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


    ffmpeg()
      .input(`uploads/${nameAndExtension[0]}${nameAndExtension[1]}`)
      .inputFormat('mp4')
      .outputOptions(outputOptions)
      .output(`uploads/720p-${nameAndExtension[0]}${nameAndExtension[1]}`)
      .on('end', () => {
        console.log(`720p copy complete using ${currentEncoding}, took ${Date.now() - startTime}ms to complete`);
      })
      .on('error', (e) => console.log(e))
      .run();
  }

  next();
};

/**Middleware for handling uploaded files. Inserts it into the database */
export const handleUpload: Middleware = (req, res, next) => {
  if (!req.file && !req.files) {
    console.log("No files were uploaded");
    return res.status(400).send("No files were uploaded.");
  }
  
  const files = (req.files) ? req.files as Express.Multer.File[] : req.file; //Check if a single file was uploaded or multiple
  const username = (req.user) ? req.user.username : "sharex";                //if no username was provided, we can presume that it is sharex
  const expireDate: Date = (req.body.expire) ? new Date(Date.now() + (req.body.expire * 24 * 60 * 60 * 1000)) : null;

  if (files instanceof Array) {
    for (const file in files) {
      insertToDB(files[file].filename, expireDate, username);
    }
  } else
    insertToDB(files.filename, expireDate, username);

  next();
};
