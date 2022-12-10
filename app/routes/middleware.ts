import type {RequestHandler as Middleware, Router, Request, Response, NextFunction} from 'express';

import ffmpeg from "fluent-ffmpeg";
import ffmpegpath from "@ffmpeg-installer/ffmpeg";
// @ts-ignore
import ffprobepath from "@ffprobe-installer/ffprobe";
ffmpeg.setFfmpegPath(ffmpegpath.path);
ffmpeg.setFfprobePath(ffprobepath.path);

import fs from "fs";
import process from "process";

import {extension} from "../types/lib";
import {db, MediaParams} from "../types/db";

export const checkAuth: Middleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401);
  }
  next();
}

export const checkSharexAuth: Middleware = (req, res, next) => {
  let auth = process.env.EBAPI_KEY || process.env.EBPASS || "pleaseSetAPI_KEY";
  let key = null;
  
  if (req.headers["key"]) {
    key = req.headers["key"];
  } else {
    return res.status(400).send("{success: false, message: \"No key provided\", fix: \"Provide a key\"}");
  }
  
  if (auth != key) {
    return res.status(401).send("{success: false, message: '\"'Invalid key\", fix: \"Provide a valid key\"}");
  }
  
  let shortKey = key.substr(0, 3) + "..."; 
  console.log(`Authenicated user with key: ${shortKey}`);
  
  next();
}

export const createEmbedData: Middleware = (req, res, next) => {
  const files = req.files as Express.Multer.File[]
  for (let file in files) {
    let nameAndExtension = extension(files[file].originalname);
    let oembed = {
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
}

export const convert: Middleware = (req, res, next)  => {
  const files = req.files as Express.Multer.File[]
  for (let file in files) {
    let nameAndExtension = extension(files[file].originalname);
    if (nameAndExtension[1] == ".mp4" || nameAndExtension[1] == ".webm" || nameAndExtension[1] == ".mkv" || nameAndExtension[1] == ".avi" || nameAndExtension[1] == ".mov") {
      console.log("Converting " + nameAndExtension[0] + nameAndExtension[1] + " to gif");
      ffmpeg()
        .input(`uploads/${nameAndExtension[0]}${nameAndExtension[1]}`)
        .inputFormat(nameAndExtension[1].substring(1))
        .outputFormat("gif")
        .output(`uploads/${nameAndExtension[0]}.gif`)
        .on("end", function() {
          console.log("Conversion complete");
          console.log(`Uploaded to uploads/${nameAndExtension[0]}.gif`);
        })
        .on("error", (e) => console.log(e))
        .run();
    } else if (nameAndExtension[1] == ".gif") {
      console.log(`Converting ${nameAndExtension[0]}${nameAndExtension[1]} to mp4`);
      ffmpeg(`uploads/${nameAndExtension[0]}${nameAndExtension[1]}`)
        .inputFormat("gif")
        .outputFormat("mp4")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-c:v libx264",
          "-movflags +faststart"
        ])
        .noAudio()
        .output(`uploads/${nameAndExtension[0]}.mp4`)
        .on("end", function() {
          console.log("Conversion complete");
          console.log(`Uploaded to uploads/${nameAndExtension[0]}.mp4`);
        })
        .run();
    }
  }
}

export const handleUpload: Middleware = (req, res, next) => {
  if (!req.file && !req.files) {
    console.log("No files were uploaded");
    return res.status(400).send("No files were uploaded.");
  }
  
  const files = (req.files) ? req.files as Express.Multer.File[] : req.file; //Check if a single file was uploaded or multiple
  const username = (req.user) ? req.user.username : "sharex"                 //if no username was provided, we can presume that it is sharex
  const expireDate: Date = (req.body.expire) ? new Date(Date.now() + (req.body.expire * 24 * 60 * 60 * 1000)) : null;

  if (files instanceof Array) {
    for (let file in files) {
      insertToDB(files[file].filename, expireDate, username, next);
    }
  } else
    insertToDB(files.filename, expireDate, username, next);

  next();
}

function insertToDB (filename: String, expireDate: Date, username: String, next: NextFunction) {
  let params: MediaParams = [
    filename, 
    expireDate, 
    username
   ]
  
  db.run("INSERT INTO media (path, expire, username) VALUES (?, ?, ?)", params, function (err) {
    if (err) { 
      console.log(err);
      return next(err);
    }
    console.log(`Uploaded ${filename} to database`);
    if (expireDate == null)
      console.log("It will not expire");
    else if (expireDate != null || expireDate != undefined)
      console.log(`It will expire on ${expireDate}`);
  });
}