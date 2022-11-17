require('dotenv').config();

let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let passport = require('passport');
let session = require('express-session');

let SQLiteStore = require('connect-sqlite3')(session);

let indexRouter = require('./routes/index');
let authRouter = require('./routes/auth');

let app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({
	extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
	secret: process.env.EBSECRET || 'pleasechangeme',
	resave: false,
	saveUninitialized: false,
	store: new SQLiteStore({
		db: 'sessions.db',
		dir: './var/db'
	})
}));
app.use(passport.authenticate('session'));

app.use('/', indexRouter);
app.use('/', authRouter);

app.use('/uploads', express.static('uploads'))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	console.log(err)
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

module.exports = app;
