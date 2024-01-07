const version = 1.12;

import "dotenv";

import express from "express";
import passport from "passport";
import session from "express-session";
import cookieParser from "cookie-parser";
import sqlite3 from "connect-sqlite3";
const SQLiteStore = sqlite3(session);

import fs from "fs";
import http from "http";
import path from "path";

import authRouter from "./routes/auth";
import indexRouter from "./routes/index";
import adduserRouter from "./routes/adduser";
import settingsRouter from "./routes/settings";

import {db, expire, createDatabase, updateDatabase, MediaRow} from "./lib/db";

const app = express();
const server = http.createServer(app);
const port = normalizePort(process.env.EBPORT || "3000");

function normalizePort(val: string) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
}

app.set("port", port);
server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function onError(error: any) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string"
    ? "Pipe " + port
    : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
  case "EACCES":
    console.error(bind + " requires elevated privileges");
    process.exit(1);
    break;
  case "EADDRINUSE":
    console.error(bind + " is already in use");
    process.exit(1);
    break;
  default:
    throw error;
  }
}


// Check if there is an existing DB or not, then check if it needs to be updated to new schema
db.get("SELECT * FROM sqlite_master WHERE name ='users' and type='table'", async (err, row) => {
  if (!row) createDatabase(3); 
  else checkVersion();
});

function checkVersion () {
  db.get("PRAGMA user_version", (err: Error, row: any) => {
    if (row && row.user_version) {
      const version = row.user_version;
      if (version != 3) console.log("DATABASE IS OUTDATED");
      updateDatabase(version, 3);
    } else {
      // Because ver 1 does not have user_version set, we can safely assume that it is ver 1
      updateDatabase(1, 3);
    }
  });
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string"
    ? "pipe " + addr
    : "port " + addr.port;
  console.log("Embedder version: " + version);
  console.log("Listening on " + bind);
}

app.enable("trust proxy");

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({
  extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.EBSECRET || "pleasechangeme",
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({
    db: "sessions.db",
    dir: "./var/db"
  }) as session.Store
}));
app.use(passport.authenticate("session"));

app.use("/", indexRouter);
app.use("/", authRouter);
app.use("/", adduserRouter);
app.use("/", settingsRouter);

app.use("/uploads", express.static("uploads"));

async function prune () {
  db.all("SELECT * FROM media", (err: Error, rows: []) => {
    console.log("Uploaded files: " + rows.length);
    console.log(rows);
  });

  console.log("Vacuuming database...");
  db.run("VACUUM");

  db.each("SELECT path FROM media WHERE expire < ?", [Date.now()], (err: Error, row: MediaRow) => {
    console.log(`Expired row: ${row}`);
    fs.unlink(`uploads/${row.path}`, (err) => {
      if (err && err.errno == -4058) {
        console.log("File already deleted");
      } else {
        if (err) console.log(err);
      }
    });
  });

  await expire("media", "expire", Date.now());
}

setInterval(prune, 1000 * 60); //prune every minute