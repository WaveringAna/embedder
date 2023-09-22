import crypto from "crypto";
import express from "express";
import passport from "passport";
import {Strategy as LocalStrategy} from "passport-local";

import {User} from "../types/lib";
import {db, UserRow} from "../types/db";

const router = express.Router();

passport.use(new LocalStrategy(function verify(username, password, cb) {
  try {
    // Fetch user from database using better-sqlite3's synchronous API
    const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow;

    if (!row) {
      return cb(null, false, {
        message: "Incorrect username or password."
      });
    }

    // Synchronously hash the provided password with the stored salt
    const hashedPassword = crypto.pbkdf2Sync(password, row.salt, 310000, 32, "sha256");

    if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
      return cb(null, false, {
        message: "Incorrect username or password."
      });
    }

    return cb(null, row);

  } catch (err) {
    return cb(err);
  }
}));


passport.serializeUser(function(user:User, cb) {
  process.nextTick(function() {
    cb(null, {
      id: user.id,
      username: user.username
    });
  });
});

passport.deserializeUser(function(user:User, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

router.get("/login", function(req, res) {
  res.render("login");
});

router.post("/login/password", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login"
}));

router.post("/logout", function(req, res, next) {
  req.logout(function(err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

export default router;
