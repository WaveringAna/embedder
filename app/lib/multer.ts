import { Request } from "express";
import multer, { FileFilterCallback } from "multer";

import { db, MediaRow } from "./db";
import { extension } from "./lib";

export type DestinationCallback = (
  error: Error | null,
  destination: string,
) => void;
export type FileNameCallback = (error: Error | null, filename: string) => void;

export const fileStorage = multer.diskStorage({
  destination: (
    request: Request,
    file: Express.Multer.File,
    callback: DestinationCallback,
  ): void => {
    callback(null, __dirname + "/../../uploads");
  },
  filename: (
    request: Request,
    file: Express.Multer.File,
    callback: FileNameCallback,
  ): void => {
    const [filename, fileExtension] = extension(file.originalname);
    console.log(`Uploading ${file}`);
    db.all(
      "SELECT * FROM media WHERE path = ?",
      [filename + fileExtension],
      (err: Error, exists: []) => {
        if (err) {
          console.log(err);
          callback(err, null);
        }
        
        if (exists.length != 0) {
          const suffix = new Date().getTime() / 1000;

          if (
            request.body.title == "" ||
            request.body.title == null ||
            request.body.title == undefined
          ) {
            callback(null, filename + "-" + suffix + fileExtension);
          } else {
            callback(null, request.body.title + "-" + suffix + fileExtension);
          }
        } else {
          if (
            request.body.title == "" ||
            request.body.title == null ||
            request.body.title == undefined
          ) {
            callback(null, filename + fileExtension);
          } else {
            callback(null, request.body.title + fileExtension);
          }
        }
      },
    );
  },
});

export let allowedMimeTypes = [
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/mov",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
];

export const setAllowedMimeTypes = (mimeTypes: string[]): void => {
  allowedMimeTypes = mimeTypes;
};

export const fileFilter = (
  request: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};
