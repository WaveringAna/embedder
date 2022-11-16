let express = require('express');
let passport = require('passport');
let LocalStrategy = require('passport-local');
let crypto = require('crypto');
let db = require('../db');

let router = express.Router();

passport.use(new LocalStrategy(function verify(username, password, cb) {
	db.get('SELECT * FROM users WHERE username = ?', [username], function(err, row) {
		if (err) {
			return cb(err);
		}
		if (!row) {
			return cb(null, false, {
				message: 'Incorrect username or password.'
			});
		}

		crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', function(err, hashedPassword) {
			if (err) {
				return cb(err);
			}
			if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
				return cb(null, false, {
					message: 'Incorrect username or password.'
				});
			}
			return cb(null, row);
		});
	});
}));

passport.serializeUser(function(user, cb) {
	process.nextTick(function() {
		cb(null, {
			id: user.id,
			username: user.username
		});
	});
});

passport.deserializeUser(function(user, cb) {
	process.nextTick(function() {
		return cb(null, user);
	});
});

router.get('/login', function(req, res, next) {
	res.render('login');
});

router.post('/login/password', passport.authenticate('local', {
	successRedirect: '/',
	failureRedirect: '/login'
}));

router.post('/logout', function(req, res, next) {
	req.logout(function(err) {
		if (err) {
			return next(err);
		}
		res.redirect('/');
	});
});

module.exports = router;
