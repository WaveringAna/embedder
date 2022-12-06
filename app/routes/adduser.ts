import type {RequestHandler as Middleware, Router, Request, Response, NextFunction} from 'express';
import express from "express";

import {db, createUser} from "../db";

const router: Router = express.Router();

const adminCheck: Middleware = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user)
        return res.status(403).send("You are not authorized to perform this action");
    else {
        //@ts-ignore
        if (req.user.username != "admin")
            return res.status(403).send("You are not authorized to perform this action");
        next();
    }
}

router.get("/adduser", adminCheck, (req: Request, res: Response, next: NextFunction) => {
    res.locals.filter = null;
	res.render("adduser", { user: req.user });
});

router.post("/adduser", adminCheck, (req: Request, res: Response, next: NextFunction) => {
    createUser(req.body.username, req.body.password);
    res.redirect('/');
});

export default router;