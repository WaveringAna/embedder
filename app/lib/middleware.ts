import type { RequestHandler as Middleware, NextFunction } from "express";

import fs from "fs";
import process from "process";

import { extension, videoExtensions, imageExtensions, oembedObj } from "./lib";
import { insertToDB } from "./db";
import { ffmpegDownscale, ffProbe } from "./ffmpeg";
import { MediaProcessor } from "../services/MediaProcesser";

export const checkAuth: Middleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401);
    }
    next();
};

/**Checks shareX auth key */
export const checkSharexAuth: Middleware = (req, res, next) => {
    const auth =
        process.env.EBAPI_KEY || process.env.EBPASS || "pleaseSetAPI_KEY";
    let key = null;

    if (req.headers["key"]) {
        key = req.headers["key"];
    } else {
        return res
            .status(400)
            .send(
                "{success: false, message: 'No key provided', fix: 'Provide a key'}",
            );
    }

    if (auth != key) {
        return res
            .status(401)
            .send(
                "{success: false, message: 'Invalid key', fix: 'Provide a valid key'}",
            );
    }

    const shortKey = key.substr(0, 3) + "...";
    console.log(`Authenicated user with key: ${shortKey}`);

    next();
};

/**
 * Creates oembed data for uploaded files
 *
 * @param {Express Request Object} Express request object
 * @param {Express Response Object} Express response object
 * @param {Express NextFunction variable} Express next function
 *
 */
export const createEmbedData: Middleware = async (req, res, next) => {
    const files = req.files as Express.Multer.File[];
    for (const file in files) {
        const [filename, fileExtension] = extension(files[file].filename);
        const isMedia =
            videoExtensions.includes(fileExtension) ||
            imageExtensions.includes(fileExtension);

        const oembed: oembedObj = {
            type: "video",
            version: "1.0",
            provider_name: "embedder",
            provider_url: "https://github.com/WaveringAna/embedder",
            cache_age: 86400,
            html: `<iframe src='${req.protocol}://${req.get(
                "host",
            )}/gifv/${filename}${fileExtension}'></iframe>`,
            title: filename,
            url: `${req.protocol}://${req.get("host")}/uploads/${filename}${fileExtension}`,
        };

        if (isMedia) {
            let ffProbeData;
            try {
                ffProbeData = await ffProbe(
                    `uploads/${files[file].filename}`,
                    filename,
                    fileExtension,
                );
            } catch (error) {
                console.log(`Error: ${error}`);
            }

            oembed.width = ffProbeData.streams[0].width;
            oembed.height = ffProbeData.streams[0].height;
        }

        fs.writeFile(
            `uploads/oembed-${filename}${fileExtension}.json`,
            JSON.stringify(oembed),
            function (err) {
                if (err) return next(err);
                console.log(`oembed file created ${filename}${fileExtension}.json`);
            },
        );
    }
    next();
};

/**
 * Creates a 720p copy of uploaded videos
 *
 * @param {Express Request Object} req Express request object
 * @param {Express Response Object} res Express response object
 * @param {Express NextFunction} next Express next function
 *
 */
export const convertTo720p: Middleware = (req, res, next) => {
    const files = req.files as Express.Multer.File[];
    console.log("convert to 720p running");
    for (const file in files) {
        const [filename, fileExtension] = extension(files[file].filename);

        //Skip if not a video
        if (!videoExtensions.includes(fileExtension) && fileExtension !== ".gif") {
            console.log(`${files[file].filename} is not a video file`);
            continue;
        }

        console.log(`Creating 720p for ${files[file].filename}`);

        ffmpegDownscale(
            `uploads/${filename}${fileExtension}`,
            filename,
            fileExtension,
        )
            .then(() => {
                //Nothing for now, can fire event flag that it is done to front end when react conversion is done
            })
            .catch((error) => {
                console.log(`Error: ${error}`);
            });
    }

    next();
};

/**Middleware for handling uploaded files. Inserts it into the database */
export const handleUpload: Middleware = async (req, res, next) => {
    if (!req.file && !req.files) {
        console.log("No files were uploaded");
        return res.status(400).send("No files were uploaded.");
    }

    const files = req.files ? (req.files as Express.Multer.File[]) : req.file;
    const username = req.user ? req.user.username : "sharex";
    const expireDate: Date = req.body.expire
        ? new Date(Date.now() + req.body.expire * 24 * 60 * 60 * 1000)
        : null;

    try {
        if (files instanceof Array) {
            await Promise.all(
                files.map((file) => insertToDB(file.filename, expireDate, username)),
            );
        } else {
            await insertToDB(files.filename, expireDate, username);
        }
        next();
    } catch (error) {
        console.error("Error in handleUpload:", error);
        res.status(500).send("Error processing files.");
    }
};

export const processUploadedMedia: Middleware = async (req, res, next) => {
    try {
        const files = req.files as Express.Multer.File[];

        for (const file of files) {
            const [filename, fileExtension] = extension(file.filename);

            if (videoExtensions.includes(fileExtension)) {
                MediaProcessor.processVideo(
                    file.path,
                    filename,
                    fileExtension
                ).catch(err => console.error("Error processing video:", err));
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};