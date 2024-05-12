import type {
    RequestHandler as Middleware,
    Request,
    Response,
    NextFunction,
} from "express";

import multer from "multer";
import express from "express";
import imageProbe from "probe-image-size";

import { ffProbe } from "../lib/ffmpeg";

import fs from "fs";
import path from "path";

import { extension, videoExtensions, oembedObj } from "../lib/lib";
import { db, MediaRow, getPath, deleteId } from "../lib/db";
import { fileStorage } from "../lib/multer";
import {
    checkAuth,
    checkSharexAuth,
    convertTo720p,
    createEmbedData,
    handleUpload,
} from "../lib/middleware";

const upload = multer({ storage: fileStorage /**, fileFilter: fileFilter**/ }); //maybe make this a env variable?
/**Middleware to grab media from media database */

const fetchMedia: Middleware = (req, res, next) => {
    const admin: boolean = req.user.username == "admin" ? true : false;
    /**Check if the user is an admin, if so, show all posts from all users */
    const query: string =
    admin == true
        ? "SELECT * FROM media"
        : `SELECT * FROM media WHERE username = '${req.user.username}'`;

    db.all(query, (err: Error, rows: []) => {
        if (err) return next(err);
        const files = rows.map((row: MediaRow) => {
            return {
                id: row.id,
                path: row.path,
                expire: row.expire,
                username: row.username,
                url: "/" + row.id,
            };
        });
        res.locals.files = files.reverse(); //reverse so newest files appear first
        res.locals.Count = files.length;
        next();
    });
};

const router = express.Router();

router.get(
    "/",
    (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return res.render("home");
        next();
    },
    fetchMedia,
    (req: Request, res: Response) => {
        res.locals.filter = null;
        res.render("index", { user: req.user });
    }
);

router.get("/media-list", fetchMedia, (req: Request, res: Response) => {
    res.render("partials/_fileList", { user: req.user });
});

router.get(
    "/gifv/:file",
    async (req: Request, res: Response, next: NextFunction) => {
        const url = `${req.protocol}://${req.get("host")}/uploads/${
            req.params.file
        }`;
        let width;
        let height;

        const [filename, fileExtension] = extension(`uploads/${req.params.file}`);
        if (
            fileExtension == ".mp4" ||
      fileExtension == ".mov" ||
      fileExtension == ".webm" ||
      fileExtension == ".gif"
        ) {
            const imageData = ffProbe(
                `uploads/${req.params.file}`,
                filename,
                fileExtension
            );

            width = (await imageData).streams[0].width;
            height = (await imageData).streams[0].height;

            return res.render("gifv", {
                url: url,
                host: `${req.protocol}://${req.get("host")}`,
                width: width,
                height: height,
            });
        } else {
            const imageData = await imageProbe(
                fs.createReadStream(`uploads/${req.params.file}`)
            );
            return res.render("gifv", {
                url: url,
                host: `${req.protocol}://${req.get("host")}`,
                width: imageData.width,
                height: imageData.height,
            });
        }
    }
);

router.get("/oembed/:file", 
    async (req: Request, res: Response) => {
        const filename = req.params.file;
        const fileExtension = filename.slice(filename.lastIndexOf("."));

        try {
            const oembedData: oembedObj = {
                type: (videoExtensions.includes(fileExtension) ? "video" : "photo"),
                version: "1.0",
                provider_name: "embedder",
                provider_url: "https://github.com/WaveringAna/embedder",
                cache_age: 86400,
                title: filename.slice(0, filename.lastIndexOf(".")),
                html: "",
                url: `${req.protocol}://${req.get("host")}/uploads/${filename}`
            };

            if (videoExtensions.includes(fileExtension) || fileExtension === ".gif") {
                const ffprobeData = await ffProbe(`uploads/${filename}`, filename, fileExtension);
                oembedData.width = ffprobeData.streams[0].width;
                oembedData.height = ffprobeData.streams[0].height;
                
                oembedData.html = `<video width="${oembedData.width}" height="${oembedData.height}" controls><source src="${oembedData.url}" type="video/${fileExtension.substring(1)}">Your browser does not support the video tag.</video>`;
            } else {
                const imageData = await imageProbe(fs.createReadStream(`uploads/${filename}`));
                oembedData.width = imageData.width;
                oembedData.height = imageData.height;

                oembedData.html = `
                    <img src="${oembedData.url}" width="${oembedData.width}" height="${oembedData.height}" alt="${filename}">
                `;
            }

            res.json(oembedData);
        } catch (error) {
            console.error("Error generating oEmbed data:", error);
            res.status(500).send("Error generating oEmbed data");
        }
    }
);

router.post(
    "/",
    [
        checkAuth,
        upload.array("fileupload"),
        convertTo720p,
        createEmbedData,
        handleUpload,
        fetchMedia,
    ],
    (req: Request, res: Response) => {
        return res.render("partials/_fileList", { user: req.user }); // Render only the file list partial
    }
);

router.post(
    "/sharex",
    [checkSharexAuth, upload.single("fileupload"), createEmbedData, handleUpload],
    (req: Request, res: Response) => {
        return res.send(
            `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        );
    }
);

router.get(
    "/:id(\\d+)/delete",
    [checkAuth],
    async (req: Request, res: Response, next: NextFunction) => {
        const filename: any = await getPath(req.params.id);
        const filePath = path.join(__dirname , "../../uploads/" + filename.path);
        const oembed = path.join(
            __dirname , "../../uploads/oembed-" + filename.path + ".json"
        );

        const [fileName, fileExtension] = extension(filePath);
        const filesToDelete = [filePath, oembed];

        if (
            videoExtensions.includes(fileExtension) ||
      fileExtension == ".gif"
        ) {
            filesToDelete.push(
                path.join(__dirname , "../../uploads/720p-" + filename.path)
            );
        }

        // Wait for all file deletions and database operations to complete
        await Promise.all(
            filesToDelete.map(async (path) => {
                return new Promise<void>((resolve, reject) => {
                    fs.unlink(path, async (err) => {
                        console.log(`Deleting ${path}`);
                        if (err) {
                            if ([-4058, -2].includes(err.errno)) {
                                //file not found
                                console.log("File not found, deleting from database");
                                await deleteId("media", req.params.id);
                            }
                            console.error(`Error deleting file ${path}:`, err);
                            reject(err);
                            return;
                        }
                        await deleteId("media", req.params.id);
                        resolve();
                    });
                });
            })
        ).catch((err) => {
            console.error("Error deleting files:", err);
            return next(err);
        });

        next();
    },
    [fetchMedia],
    (req: Request, res: Response) => {
        return res.render("partials/_fileList", { user: req.user });
    }
);

export default router;
