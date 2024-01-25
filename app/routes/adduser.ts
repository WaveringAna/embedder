import type {RequestHandler as Middleware, Router, Request, Response, NextFunction} from "express";
import express from "express";

import {createUser} from "../lib/db";

const router: Router = express.Router();
/**Middleware to check if a user is actually signed in */
const adminCheck: Middleware = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user)
        return res.status(403).send("You are not authorized to perform this action");
    else {
        if (req.user.username != "admin")
            return res.status(403).send("You are not authorized to perform this action");
    }

    next();
};

router.get("/adduser", adminCheck, (req: Request, res: Response) => {
    res.locals.filter = null;
    res.render("adduser", { user: req.user });
});

router.post("/adduser", adminCheck, (req: Request, res: Response) => {
    createUser(req.body.username, req.body.password);
    res.redirect("/");
});

export default router;