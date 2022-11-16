let express = require('express');
let multer = require('multer');

let db = require('../db');
let fs = require('fs');

function extension(string) {
  return string.slice((string.lastIndexOf(".") - 2 >>> 0) + 2);
}

function extension(str){
  let file = str.split('/').pop();
  return [file.substr(0,file.lastIndexOf('.')),file.substr(file.lastIndexOf('.'),file.length)]
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename : function(req, file, cb) {
    db.all('SELECT * FROM media WHERE path = ?', [file.originalname], function (err, exists) {
      if (exists.length != 0) {
        let suffix = new Date().getTime() / 1000;
        let nameAndExtension = extension(file.originalname);

        if (req.body.title == '' || req.body.title  == null || req.body.title == undefined)
          cb(null, nameAndExtension[0] + '-' + suffix + nameAndExtension[1])
        else
          cb(null, req.body.title + '-' + suffix + nameAndExtension[1])
      } else {
        if (req.body.title == '' || req.body.title  == null || req.body.title == undefined)
          cb(null, file.originalname)
        else
          cb(null, req.body.title + nameAndExtension[1])
      }
    })
  }
});

const fileFilter = function(req, file, cb) {
    if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg" || file.mimetype == "image/gif" || file.mimetype == "image/webp"
      || file.mimetype == "video/mp4" || file.mimetype == "video/mov" || file.mimetype == "video/webm"
      || file.mimetype == "audio/mpeg" || file.mimetype == "audio/ogg") {
        cb(null, true)
      } else {
        cb(null, false);
        //return cb(new Error('Only media files allowed'));
      }
  }

let upload = multer({ storage: storage, fileFilter: fileFilter });

function fetchMedia(req, res, next) {
  db.all('SELECT * FROM media', (err, rows) => {
    if (err) return next(err);
    let files = rows.map((row)=> {
      return {
        id: row.id,
        path: row.path,
        expire: row.expire,
        url: '/' + row.id
      }
    });
    res.locals.files = files.reverse(); //reverse so newest files appear first
    res.locals.Count = files.length;
    next();
  });
}

let router = express.Router();

router.get('/', function (req, res, next) {
    if (!req.user) { return res.render('home'); }
    next();
}, fetchMedia, function(req, res, next) {
    res.locals.filter = null;
    res.render('index', { user: req.user });
});

router.post('/', upload.array('fileupload'), function(req, res, next) {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  for (file in req.files) {
    db.run('INSERT INTO media (path) VALUES (?)', [req.files[file].filename], function (err) {
    if (err) return next(err);
      return res.redirect('/');
    })
  }
});

router.post('/:id(\\d+)/delete', function(req, res, next) {
  db.all('SELECT path FROM media WHERE id = ?', [ req.params.id ], function(err, path) {
    if (err) { return next(err); }
    fs.unlink('uploads/' + path[0].path, (err => {
      if (err) {
        console.log(err)
        if (err.errno = -4058) { //File just doesnt exist anymore
          db.run('DELETE FROM media WHERE id = ?', [
            req.params.id
          ], function(err) {
            if (err) { return next(err); }
              return res.redirect('/');
          });
        } else {
          console.log(err)
          return res.redirect('/');
        }
      }
      else {
        console.log(`Deleted ${path}`);
        //Callback Hell :D
        db.run('DELETE FROM media WHERE id = ?', [
          req.params.id
        ], function(err) {
          if (err) { return next(err); }
            return res.redirect('/');
        });
      }
    }));
  });
});

module.exports = router;
