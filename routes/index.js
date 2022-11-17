let express = require('express');
let multer = require('multer');

let db = require('../db');
let fs = require('fs');

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

let allowedMimeTypes = [
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/mov',
  'video/webm',
  'audio/mpeg',
  'audio/ogg'
]

const fileFilter = function(req, file, cb) {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
}

let upload = multer({ storage: storage /**, fileFilter: fileFilter**/ }); //maybe make this a env variable?

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
    console.log(req)
    return res.status(400).send('No files were uploaded.');
  }

  for (file in req.files) {
    db.run('INSERT INTO media (path) VALUES (?)', [req.files[file].filename], function (err) {
    if (err) { console.log(err)
      return next(err);
    }
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
