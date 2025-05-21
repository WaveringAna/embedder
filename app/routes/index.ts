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

import * as fsPromises from 'fs/promises';
import mime from 'mime-types';
import { extension, videoExtensions, oembedObj } from "../lib/lib";
import { db, MediaRow, getPath, deleteId } from "../lib/db";
import { fileStorage } from "../lib/multer"; // Existing multer storage
import { progressManager } from "../services/ProgressManager";
import {
    checkAuth,
    checkSharexAuth,
    createEmbedData,
    handleUpload,
    processUploadedMedia,
} from "../lib/middleware";

const processVideo: boolean = process.env["EB_PROCESS_VIDEO"] !== "false";

const upload = multer({ storage: fileStorage /**, fileFilter: fileFilter**/ }); //maybe make this a env variable?

// Multer configuration for chunked uploads
const chunkStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const originalFilename = req.body.originalFilename;
        if (!originalFilename) {
            return cb(new Error("Missing originalFilename"), "");
        }
        const dirPath = path.join("uploads", "tmp", originalFilename);
        fs.mkdir(dirPath, { recursive: true }, (err) => {
            if (err) {
                return cb(err, "");
            }
            cb(null, dirPath);
        });
    },
    filename: (req, file, cb) => {
        const chunkIndex = req.body.chunkIndex;
        if (chunkIndex === undefined) {
            return cb(new Error("Missing chunkIndex"), "");
        }
        cb(null, String(chunkIndex));
    },
});

const uploadChunk = multer({ storage: chunkStorage });

// Middleware for explicit error handling for /upload/chunk
const handleUploadChunkError: Middleware = (req, res, next) => {
    uploadChunk.single("chunk")(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading (e.g., file too large if limits were set).
            return res.status(400).send(`Upload error (Multer): ${err.message}`);
        } else if (err) {
            // An error from fs.mkdir or other fs operations in storage.
            console.error(`[CHUNK_UPLOAD_STORAGE_ERROR] Failed to store chunk for ${req.body.originalFilename}: ${err.message}`);
            return res.status(500).send(`Server error during chunk storage: ${err.message}`);
        }
        // If no error from multer middleware, proceed. req.file should be populated.
        next();
    });
};

/**Middleware to grab media from media database */

const fetchMedia: Middleware = (req, res, next) => {
    const admin: boolean = req.user.username == "admin" ? true : false;
    const query: string = admin
        ? "SELECT * FROM media"
        : "SELECT * FROM media WHERE username = ?";

    const params: any[] = admin ? [] : [req.user.username];

    db.all(query, params, (err: Error, rows: []) => {
        if (err) {
            console.error("Error fetching media:", err);
            return res.status(500).send("Database error");
        }
        const files = rows.map((row: MediaRow) => {
            const isProcessed = videoExtensions.includes(extension(row.path)[1]) ?
                fs.existsSync(`uploads/720p-${row.path}`) :
                true;

            return {
                id: row.id,
                path: row.path,
                expire: row.expire,
                username: row.username,
                url: "/" + row.id,
                isProcessed
            };
        });
        res.locals.files = files.reverse();
        res.locals.Count = files.length;
        next();
    });
};

const router = express.Router();

router.get('/progress-updates', (req, res) => {
    if (!processVideo) {
        res.status(404).send('Video processing is disabled');
        return;
    }

    console.log("SSE connection requested");  // Debug log

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send an initial message to confirm connection
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const sendUpdate = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    progressManager.subscribeToUpdates(sendUpdate);

    // Clean up on client disconnect
    req.on('close', () => {
        console.log("SSE connection closed");  // Debug log
        progressManager.unsubscribeFromUpdates(sendUpdate);
    });
});

router.get(
    "/",
    (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return res.render("home");
        next();
    },
    fetchMedia,
    (req: Request, res: Response) => {
        res.locals.filter = null;
        res.render("index", { user: req.user, processVideo });
    }
);

router.get("/media-list", fetchMedia, (req: Request, res: Response) => {
    res.render("partials/_fileList", { user: req.user, processVideo });
});

router.get(
    "/gifv/:file",
    async (req: Request, res: Response, next: NextFunction) => {
        const url = `${req.protocol}://${req.get("host")}/uploads/${req.params.file
            }`;
        let width;
        let height;

        const [filename, fileExtension] = extension(`uploads/${req.params.file}`);
        if (
            videoExtensions.includes(fileExtension)
        ) {
            try {
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
            } catch (error) {
                console.error("Error processing video:", error);
                return res.render("gifv", {
                    url: url,
                    host: `${req.protocol}://${req.get("host")}`,
                    width: 800,
                    height: 600,
                });
            }
        } else {
            try {
                const imageData = await imageProbe(
                    fs.createReadStream(`uploads/${req.params.file}`)
                );
                return res.render("gifv", {
                    url: url,
                    host: `${req.protocol}://${req.get("host")}`,
                    width: imageData.width,
                    height: imageData.height,
                });
            } catch (error) {
                console.error("Error processing image:", error);
                return res.render("gifv", {
                    url: url,
                    host: `${req.protocol}://${req.get("host")}`,
                    width: 800,
                    height: 600,
                });
            }
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

if (processVideo) {
    router.post(
        "/",
        [
            checkAuth,
            upload.array("fileupload"),
            handleUpload,
            fetchMedia,
            processUploadedMedia,
            createEmbedData,
        ],
        (req: Request, res: Response) => {
            return res.render("partials/_fileList", { user: req.user, processVideo }); // Render only the file list partial
        }
    );
} else {
    router.post(
        "/",
        [
            checkAuth,
            upload.array("fileupload"),
            handleUpload,
            fetchMedia,
            createEmbedData
        ],
        (req: Request, res: Response) => {
            return res.render("partials/_fileList", { user: req.user, processVideo }); // Render only the file list partial
        }
    );
}
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
        const filePath = path.join(__dirname, "../../uploads/" + filename.path);
        const oembed = path.join(
            __dirname, "../../uploads/oembed-" + filename.path + ".json"
        );

        const [fileName, fileExtension] = extension(filePath);
        const filesToDelete = [filePath, oembed];

        if (
            videoExtensions.includes(fileExtension) ||
            fileExtension == ".gif"
        ) {
            filesToDelete.push(
                path.join(__dirname, "../../uploads/720p-" + filename.path)
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

// Route for uploading chunks
router.post("/upload/chunk", handleUploadChunkError, (req: Request, res: Response) => {
    // If we reach here, multer middleware (via handleUploadChunkError) succeeded and req.file is set.
    const { originalFilename, chunkIndex, totalChunks } = req.body;

    // This check is important because req.body fields are not validated by multer's storage funcs directly for response.
    // While originalFilename and chunkIndex are used by storage (and errors there would be caught by handleUploadChunkError),
    // totalChunks is not. Also, ensures client sent all expected fields.
    if (!originalFilename || chunkIndex === undefined || totalChunks === undefined) {
        // This case implies that multer successfully saved the file using originalFilename and chunkIndex (or they were missing and error handled)
        // but the body is still incomplete. This is an inconsistent state.
        // It's unlikely if originalFilename and chunkIndex were present for storage, but good to keep.
        // If an error occurred, the chunk might have been saved. Consider if cleanup is needed.
        // However, the file is tiny, and a scheduled cleanup will handle orphaned chunks.
        console.warn(`[CHUNK_UPLOAD_METADATA_WARN] Chunk for ${originalFilename}, index ${chunkIndex} uploaded, but metadata incomplete in final handler. TotalChunks: ${totalChunks}`);
        return res.status(400).send("Incomplete metadata (originalFilename, chunkIndex, or totalChunks must be provided).");
    }
    
    // The `if (!req.file)` check is now less critical here because `handleUploadChunkError` would catch
    // errors that lead to `req.file` not being set. However, as a safeguard:
    if (!req.file) {
        console.error("[CHUNK_UPLOAD_INTERNAL_ERROR] req.file is not set after handleUploadChunkError succeeded. This should not happen.");
        return res.status(500).send("Internal server error: chunk data not found after upload.");
    }

    // console.log(`Received chunk ${chunkIndex}/${totalChunks} for ${originalFilename} at ${req.file.path}`);
    res.status(200).send({
        message: "Chunk uploaded successfully.",
        chunkIndex: Number(chunkIndex), // Ensure chunkIndex is a number in the response
        originalFilename: originalFilename,
    });
});

export default router;

// Route for completing chunk upload and reassembling file
router.post("/upload/complete", checkAuth, async (req: Request, res: Response, next: NextFunction) => {
    const { originalFilename, totalChunks: totalChunksStr } = req.body;
    const totalChunks = parseInt(totalChunksStr, 10);

    if (!originalFilename || !totalChunksStr || isNaN(totalChunks) || totalChunks <= 0) {
        return res.status(400).send("Missing or invalid originalFilename or totalChunks.");
    }

    const tempDir = path.join("uploads", "tmp", originalFilename);
    const finalFilePath = path.join("uploads", originalFilename);

    try {
        // Verify chunks
        const chunkFiles = await fsPromises.readdir(tempDir);
        if (chunkFiles.length !== totalChunks) {
            return res.status(400).send(`Expected ${totalChunks} chunks, but found ${chunkFiles.length}.`);
        }

        // Sort chunk files numerically by name (0, 1, 2, ...)
        chunkFiles.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

        // Concatenate chunks
        const writeStream = fs.createWriteStream(finalFilePath);
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(tempDir, String(i));
            // Ensure chunk file exists, though readdir should have confirmed counts
            try {
                await fsPromises.access(chunkPath); 
            } catch (e) {
                writeStream.end(); // Close stream before erroring
                await fsPromises.unlink(finalFilePath).catch(() => {}); // Attempt to delete partial file
                return res.status(400).send(`Chunk ${i} is missing.`);
            }
            
            const readStream = fs.createReadStream(chunkPath);
            await new Promise((resolve, reject) => {
                readStream.pipe(writeStream, { end: false }); // Don't end the writestream yet
                readStream.on('end', resolve);
                readStream.on('error', reject);
            });
        }
        writeStream.end(); // Now close the write stream

        // Cleanup temporary directory
        await fsPromises.rm(tempDir, { recursive: true, force: true });

        // Get file stats for the assembled file
        const stats = await fsPromises.stat(finalFilePath);

        // Mock req.files for subsequent middleware
        // handleUpload and other middleware expect req.files to be an array
        // and file.filename to be the name of the file in the 'uploads' dir.
        // file.path (as used by handleUpload) is also this filename.
        const mockedFile = {
            filename: originalFilename, // Name in 'uploads' dir and for DB 'path'
            originalname: originalFilename, // Original name from client
            path: originalFilename, // Expected by handleUpload for DB 'path'
            destination: "uploads/", // Base directory where file is stored
            mimetype: mime.lookup(originalFilename) || "application/octet-stream",
            size: stats.size,
            stream: fs.createReadStream(finalFilePath), // Not typically used by next middleware but good to have
            buffer: Buffer.from([]), // Empty buffer, not used by next middleware
        };
        // @ts-ignore
        req.files = [mockedFile]; // handleUpload expects an array

        // Call existing middleware chain
        handleUpload(req, res, (err?: any) => {
            if (err) {
                console.error("Error in handleUpload after chunk assembly:", err);
                return next(err); // Pass error to Express error handler
            }
            fetchMedia(req, res, (errFetch?: any) => {
                if (errFetch) {
                    console.error("Error in fetchMedia after chunk assembly:", errFetch);
                    return next(errFetch);
                }
                const afterProcessOrSkip = (errProcess?: any) => {
                    if (errProcess) {
                        console.error("Error in processUploadedMedia after chunk assembly:", errProcess);
                        return next(errProcess);
                    }
                    createEmbedData(req, res, (errCreate?: any) => {
                        if (errCreate) {
                            console.error("Error in createEmbedData after chunk assembly:", errCreate);
                            return next(errCreate);
                        }
                        // All middleware succeeded, render the file list
                        return res.render("partials/_fileList", { user: req.user, processVideo });
                    });
                };

                if (processVideo && videoExtensions.includes(extension(originalFilename)[1])) {
                     processUploadedMedia(req, res, afterProcessOrSkip);
                } else {
                    afterProcessOrSkip(); // Skip video processing
                }
            });
        });

    } catch (error) {
        console.error("Error in /upload/complete:", error);
        // Attempt to clean up partial file if it exists
        await fsPromises.unlink(finalFilePath).catch(() => {});
        // Attempt to clean up temp dir as well
        await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        return res.status(500).send("Error processing file completion.");
    }
});
