import type {RequestHandler as Middleware, Request, Response, NextFunction} from 'express';
import multer from "multer";
import express from "express";
import ffmpeg from "fluent-ffmpeg";
import imageProbe from "probe-image-size";
import ffmpegpath from "@ffmpeg-installer/ffmpeg";
// @ts-ignore
import ffprobepath from "@ffprobe-installer/ffprobe";

ffmpeg.setFfmpegPath(ffmpegpath.path);
ffmpeg.setFfprobePath(ffprobepath.path);

import fs from "fs";

import {extension} from "../lib";
import {db, MediaRow} from "../db";
import {fileStorage, fileFilter} from "../multer";
import {checkAuth, checkSharexAuth, createEmbedData, handleUpload} from "./middleware";

let upload = multer({ storage: fileStorage /**, fileFilter: fileFilter**/ }); //maybe make this a env variable?

const fetchMedia: Middleware = (req, res, next) => {
	//@ts-ignore
	let admin: boolean = req.user.username == "admin" ? true : false
	//@ts-ignore
	let query: string = admin == true ? "SELECT * FROM media" : `SELECT * FROM media WHERE username = '${req.user.username}'`;

	db.all(query, (err:Error, rows: []) => {
		if (err) return next(err);
		let files = rows.map((row: MediaRow)=> {
			return {
				id: row.id,
				path: row.path,
				expire: row.expire,
				username: row.username,
				url: "/" + row.id
			};
		});
		res.locals.files = files.reverse(); //reverse so newest files appear first
		res.locals.Count = files.length;
		next();
	});
}

let router = express.Router();

router.get("/", (req: Request, res: Response, next: NextFunction) => {
	if (!req.user)
		return res.render("home")
	next();
}, fetchMedia, (req: Request, res: Response) => {
	res.locals.filter = null;
	res.render("index", { user: req.user });
});

router.get("/gifv/:file", async (req, res, next) => {
	let url = `${req.protocol}://${req.get("host")}/uploads/${req.params.file}`;
	let width; let height;

	let nameAndExtension = extension(`uploads/${req.params.file}`);
	if (nameAndExtension[1] == ".mp4" || nameAndExtension[1] == ".mov" || nameAndExtension[1] == ".webm" || nameAndExtension[1] == ".gif") {
		ffmpeg()
		.input(`uploads/${req.params.file}`)
		.inputFormat(nameAndExtension[1].substring(1))
		.ffprobe((err: Error, data: ffmpeg.FfprobeData) => {
			if (err) return next(err);
			width = data.streams[0].width;
			height = data.streams[0].height;
			return res.render("gifv", { url: url, host: `${req.protocol}://${req.get("host")}`, width: width, height: height });
		}); 
	} else {
		let imageData = await imageProbe(fs.createReadStream(`uploads/${req.params.file}`));
		return res.render("gifv", { url: url, host: `${req.protocol}://${req.get("host")}`, width: imageData.width, height: imageData.height });
	} 
});

router.post("/", [checkAuth, upload.array("fileupload"), createEmbedData, handleUpload], (req: Request, res: Response) => {
	res.redirect("/")
});

router.post("/sharex", [checkSharexAuth, upload.single("fileupload"), createEmbedData, handleUpload], (req: Request, res: Response) => {
	return res.send(`${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`);
});

router.post("/:id(\\d+)/delete", [checkAuth], (req: Request, res: Response, next: NextFunction) => {
	db.all("SELECT path FROM media WHERE id = ?", [ req.params.id ], (err: Error, path: Array<any>) => {
		if (err) { return next(err); }
		fs.unlink(`uploads/${path[0].path}`, (err => {
			if (err) {
				console.log(err);
				if (err.errno == -4058) { //File just doesnt exist anymore
					db.run("DELETE FROM media WHERE id = ?", [
						req.params.id
					], (err: Error) => {
						if (err) { return next(err); }
						return res.redirect("/");
					});
				} else {
					console.log(err);
					return res.redirect("/");
				}
			} else {
				console.log(`Deleted ${path}`);
				//Callback Hell :D
				db.run("DELETE FROM media WHERE id = ?", [
					req.params.id
				], (err: Error) => {
					if (err) { return next(err); }
					return res.redirect("/");
				});
			}
		}));
	});
});

export default router;