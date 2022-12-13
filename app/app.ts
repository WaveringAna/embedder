const version = 1.9;

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

import {db, expire, createUser, MediaRow} from "./types/db";

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

db.serialize(function() {
  // Check if there is an existing DB or not
  // Check if the database is empty
  db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'", function(err, row) {
    if (row.count === 0) createDatabase;
  });

  //Update old databases, Current version is 2
  db.get("PRAGMA user_version", (err: Error, row: any) => {
    if (row && row.user_version) {
      const version = row.user_version;
      if (version != 2) console.log("DATABASE IS OUTDATED");
      //updateDatabase();
    } else {
      //Old database is version 1 without username support for images and expire support for users
      //Because ver 1 does not have user_version set, we can safely assume that it is ver 1
      updateDatabase(1, 2);
    }
  });
  
  createUser("admin", process.env.EBPASS || "changeme");
});

function createDatabase(version: number){
  // create the database schema for the embedders app
  console.log("Creating database");

  db.run("CREATE TABLE IF NOT EXISTS users ( \
    id INTEGER PRIMARY KEY, \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    expire INTEGER, \
    salt BLOB \
  )");

  db.run("CREATE TABLE IF NOT EXISTS media ( \
    id INTEGER PRIMARY KEY, \
    path TEXT NOT NULL, \
    expire INTEGER, \
    username TEXT \
  )");

  db.run(`PRAGMA user_version = ${version}`);
}

/**Updates old Database schema to new */
function updateDatabase(oldVersion: number, newVersion: number){
  if (oldVersion == 1) {
    console.log(`Updating database from ${oldVersion} to ${newVersion}`);
    db.run("PRAGMA user_version = 2", (err) => {
      if(err) return;
    });
    db.run("ALTER TABLE media ADD COLUMN username TEXT", (err) => {
      if(err) return;
    });
  
    db.run("ALTER TABLE users ADD COLUMN expire TEXT", (err) => {
      if(err) return;
    });
  }
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
      }
    });
  });

  await expire("media", "expire", Date.now());
}

setInterval(prune, 1000 * 60); //prune every minute