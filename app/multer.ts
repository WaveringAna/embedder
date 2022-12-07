import {Request} from 'express';
import multer, {FileFilterCallback} from 'multer';

import {db, MediaRow} from './db'
import {extension} from './lib'

export type DestinationCallback = (error: Error | null, destination: string) => void
export type FileNameCallback = (error: Error | null, filename: string) => void

export const fileStorage = multer.diskStorage({
  destination: (
    request: Request,
    file: Express.Multer.File,
    callback: DestinationCallback
  ): void => {
    callback(null, __dirname + "/../uploads");
  },
  filename: (
    request: Request,
    file: Express.Multer.File,
    callback: FileNameCallback
  ): void => {
    let nameAndExtension = extension(file.originalname);
    console.log(`Uploading ${file}`);
    db.all("SELECT * FROM media WHERE path = ?", [nameAndExtension[0] + nameAndExtension[1]],  (err: Error, exists: []) => {
      if (err) {
        console.log(err)
        callback(err, null)
      }
      if (exists.length != 0) {
        let suffix = new Date().getTime() / 1000;

        if (request.body.title == "" || request.body.title  == null || request.body.title == undefined) {
          callback(null, nameAndExtension[0] + "-" + suffix + nameAndExtension[1]);
        } else {
          callback(null, request.body.title + "-" + suffix + nameAndExtension[1]);
        }
      } else {
        if (request.body.title == "" || request.body.title  == null || request.body.title == undefined) {
          callback(null, nameAndExtension[0] + nameAndExtension[1]);
        } else {
          callback(null, request.body.title + nameAndExtension[1]);
        }
      }
    });
  }
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
	"audio/ogg"
];

export const fileFilter = (
  request: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true)
  } else {
      callback(null, false)
  }
}