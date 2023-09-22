import {Request} from "express";
import multer, {FileFilterCallback, MulterError} from "multer";

import {db, MediaRow} from "./db";
import {extension} from "./lib";

export type DestinationCallback = (error: Error | null, destination: string) => void
export type FileNameCallback = (error: Error | null, filename: string) => void

export const fileStorage = multer.diskStorage({
  destination: (
    request: Request,
    file: Express.Multer.File,
    callback: DestinationCallback
  ): void => {
    callback(null, __dirname + "/../../uploads");
  },
  filename: (
    request: Request,
    file: Express.Multer.File,
    callback: FileNameCallback
  ): void => {
    const nameAndExtension = extension(file.originalname);
    console.log(`Uploading ${file}`);
    try {
      console.log("querying")
      const query = db.query(`SELECT * FROM media WHERE path = ?`);
      const exists = query.all(nameAndExtension[0] + nameAndExtension[1]);
      console.log(exists)

      if (exists.length !== 0) {
        const suffix = (new Date().getTime() / 1000).toString();
        const newName = (request.body.title || nameAndExtension[0]) + "-" + suffix + nameAndExtension[1];
        callback(null, newName);
        console.log("ran callback with suffix")
      } else {
        const newName = (request.body.title || nameAndExtension[0]) + nameAndExtension[1];
        callback(null, newName);
        console.log("ran callback")
      }
    } catch (err: any) {
      console.log(err);
      callback(err, null); 
    }
  }
});

export const allowedMimeTypes = [
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/mov",
  "video/webm",
  "audio/mpeg",
  "audio/ogg"
];
  
export const fileFilter = (
  request: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};