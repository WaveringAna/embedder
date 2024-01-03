import { Request } from "express";
import multer, { FileFilterCallback } from "multer";

import { db } from "./db";
import { extension } from "./lib";

export type DestinationCallback = (
  error: Error | null,
  destination: string,
) => void;
export type FileNameCallback = (error: Error | null, filename: string) => void;

let randomizeNames = false;

if (process.env["EB_RANDOMIZE_NAMES"] === "true") {
  randomizeNames = true;
}

console.log(`Randomize names is set ${randomizeNames}`);

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

        let filenameSet = true;
        let existsBool = true;

        if (
          request.body.title == "" ||
          request.body.title == null ||
          request.body.title == undefined
        ) {
          filenameSet = false;
        }

        if (exists.length == 0) {
          existsBool = false;
        }

        if (randomizeNames) {
          //Chance of collision is extremely low, not worth checking for
          callback(null, Math.random().toString(36).slice(2, 10) + fileExtension);
          return;
        }
        
        if (filenameSet && existsBool) {
          callback(null, request.body.title + fileExtension);
          return;
        }

        if (!filenameSet && existsBool) {
          callback(null, filename + fileExtension);
          return;
        }

        if (filenameSet && !existsBool) {
          callback(null, request.body.title + fileExtension);
          return;
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
