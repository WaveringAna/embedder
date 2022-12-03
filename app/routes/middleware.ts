import type {MediaRow, UserRow} from '../types';
import type {RequestHandler as Middleware, Router, Request, Response} from 'express';

import ffmpeg from "fluent-ffmpeg";
import ffmpegpath from "@ffmpeg-installer/ffmpeg";
// @ts-ignore
import ffprobepath from "@ffprobe-installer/ffprobe";
ffmpeg.setFfmpegPath(ffmpegpath.path);
ffmpeg.setFfprobePath(ffprobepath.path);

import fs from "fs";
import process from "process";

import db from "../db";

function extension(str: String){
	let file = str.split("/").pop();
	return [file.substr(0,file.lastIndexOf(".")),file.substr(file.lastIndexOf("."),file.length).toLowerCase()];
}

//Checks ShareX key
export const checkAuth: Middleware = (req: Request, res: Response, next: Function) => {
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
	console.log("Authenicated user with key: " + shortKey);
  
	next();
}
  
//Converts mp4 to gif and vice versa with ffmpeg
export const convert: Middleware = (req: Request, res: Response, next: Function) => {
	for (let file in req.files) {
		// @ts-ignore
		let nameAndExtension = extension(req.files[file].originalname);
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
  
		/**if (nameAndExtension[1] == ".mp4") {
			console.log("Converting " + nameAndExtension[0] + nameAndExtension[1] + " to gif");
			console.log(nameAndExtension[0] + nameAndExtension[1]);
			ffmpeg()
				.input(`uploads/${nameAndExtension[0]}${nameAndExtension[1]}`)
				.inputFormat("mp4")
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
		}**/
	}
  
	next();
}
  
export const handleUpload: Middleware = (req: Request, res: Response, next: Function) => {
	if (!req.files || Object.keys(req.files).length === 0) {
		console.log("No files were uploaded");
		return res.status(400).send("No files were uploaded.");
	}
  
	for (let file in req.files) {
		let currentdate = Date.now();
		let expireDate: Date;
		if (req.body.expire) {
			expireDate = new Date(currentdate + (req.body.expire * 24 * 60 * 60 * 1000));
			console.log(req.body.expire);
			console.log(expireDate);
		} else
			expireDate = null;
			// @ts-ignore
		db.run("INSERT INTO media (path, expire) VALUES (?, ?)", [req.files[file].filename, expireDate], function (err) {
			if (err) { 
				console.log(err);
				return next(err);
			}
			// @ts-ignore
			console.log(`Uploaded ${req.files[file].filename} to database`);
			if (expireDate == null)
				console.log("It will not expire");
			else if (expireDate != null || expireDate != undefined)
				console.log(`It will expire on ${expireDate}`);
		});
	}

	next();
}