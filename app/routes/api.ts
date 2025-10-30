import type { RequestHandler as Middleware, Request, Response, NextFunction } from "express";
import express from "express";
import multer from "multer";
import { fileStorage } from "../lib/multer";
import { cfg } from "../config";
import { db, MediaRow, deleteId } from "../lib/db";
import { extension, videoExtensions } from "../lib/lib";
import {
    checkAuth,
    handleUpload,
    processUploadedMedia,
    createEmbedData,
} from "../lib/middleware";
import fs from "fs";
import path from "path";

const { processVideo } = cfg;
const upload = multer({ storage: fileStorage });

const router = express.Router();

// Middleware to fetch media from database and return as JSON
const fetchMediaJSON: Middleware = (req, res, next) => {
    const admin: boolean = req.user?.username === "admin";
    const query: string = admin
        ? "SELECT * FROM media"
        : "SELECT * FROM media WHERE username = ?";

    const params: any[] = admin ? [] : [req.user?.username];

    db.all(query, params, async (err: Error, rows: []) => {
        if (err) {
            console.error("Error fetching media:", err);
            return res.status(500).json({ error: "Database error" });
        }

        const files = await Promise.all(rows.map(async (row: MediaRow) => {
            let isProcessed = true;
            if (videoExtensions.includes(extension(row.path)[1])) {
                try {
                    await fs.promises.access(`uploads/720p-${row.path}`);
                    isProcessed = true;
                } catch {
                    isProcessed = false;
                }
            }

            return {
                id: row.id,
                path: row.path,
                expire: row.expire,
                username: row.username,
                url: "/" + row.id,
                isProcessed
            };
        }));

        res.json({ files: files.reverse(), count: files.length });
    });
};

// Get user config - don't require auth, just check if authenticated
router.get("/config", (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({
            authenticated: false,
            error: 'Not authenticated'
        });
    }

    res.json({
        authenticated: true,
        user: {
            username: req.user.username,
        },
        processVideo,
    });
});

// Get media list
router.get("/media-list", checkAuth, fetchMediaJSON);

// Upload endpoint
if (processVideo) {
    router.post(
        "/upload",
        [
            checkAuth,
            upload.array("fileupload"),
            handleUpload,
            processUploadedMedia,
            createEmbedData,
        ],
        (req: Request, res: Response) => {
            return res.json({ success: true });
        }
    );
} else {
    router.post(
        "/upload",
        [
            checkAuth,
            upload.array("fileupload"),
            handleUpload,
            createEmbedData
        ],
        (req: Request, res: Response) => {
            return res.json({ success: true });
        }
    );
}

// Delete endpoint
router.delete(
    "/:id(\\d+)/delete",
    [checkAuth],
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filename: any = await new Promise((resolve, reject) => {
                db.get("SELECT path FROM media WHERE id = ?", [req.params.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!filename) {
                return res.status(404).json({ error: "File not found" });
            }

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

            // Delete all files
            await Promise.all(
                filesToDelete.map(async (path) => {
                    return new Promise<void>((resolve, reject) => {
                        fs.unlink(path, async (err) => {
                            console.log(`Deleting ${path}`);
                            if (err) {
                                if ([-4058, -2].includes(err.errno)) {
                                    console.log("File not found, deleting from database");
                                    await deleteId("media", req.params.id);
                                    resolve();
                                    return;
                                }
                                console.error(`Error deleting file ${path}:`, err);
                                reject(err);
                                return;
                            }
                            resolve();
                        });
                    });
                })
            );

            // Delete from database
            await deleteId("media", req.params.id);

            res.json({ success: true });
        } catch (err) {
            console.error("Error deleting files:", err);
            return res.status(500).json({ error: "Failed to delete file" });
        }
    }
);

export default router;
