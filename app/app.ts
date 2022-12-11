require("dotenv").config();

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

let app = express();
let server = http.createServer(app);
let port = normalizePort(process.env.EBPORT || "3000");

function normalizePort(val: string) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
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

  var bind = typeof port === "string"
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
  // create the database schema for the embedders app
  db.run("CREATE TABLE IF NOT EXISTS users ( \
      id INTEGER PRIMARY KEY, \
      username TEXT UNIQUE, \
      hashed_password BLOB, \
      salt BLOB \
    )");

  db.run("CREATE TABLE IF NOT EXISTS media ( \
      id INTEGER PRIMARY KEY, \
      path TEXT NOT NULL, \
      expire INTEGER \, \
      username TEXT \
    )");

  db.run("ALTER TABLE media ADD COLUMN username TEXT", (err) => {
    if(err)
      return;
  }); //TODO, version new DB, run this command when detecting old DB
  
  createUser("admin", process.env.EBPASS || "changeme");
});

function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string"
    ? "pipe " + addr
    : "port " + addr.port;
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
  // @ts-ignore
  store: new SQLiteStore({
    db: "sessions.db",
    dir: "./var/db"
  })
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