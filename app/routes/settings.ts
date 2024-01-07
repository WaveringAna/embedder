import type {
    RequestHandler as Middleware,
    Request,
    Response,
    NextFunction,
} from "express";

import express from "express";

import { db, UserRow } from "../lib/db";

const router = express.Router();

const fetchUsers = (): Promise<[UserRow]> => {
    const query = "SELECT * FROM users";

    return new Promise((resolve, reject) => {
        db.all(query, (err: Error, rows: [UserRow]) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

const fetchSettings: Middleware = async (req, res, next) => {
    res.locals.users = req.user.username == "admin" ? await fetchUsers() : null;
    next();
};

router.get(
    "/settings",
    (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return res.render("home");
        console.log(req.user);
        next();
    },
    fetchSettings,
    (req: Request, res: Response) => {
        res.locals.filter = null;
        req.user.username == "admin" ? res.render("settings", { user: req.user, userList: res.locals.users }) : res.redirect("/");
    }
);

export default router;