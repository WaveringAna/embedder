let express = require('express');
let multer = require('multer');

let fs = require('fs');

function extension(string) {
  return string.slice((string.lastIndexOf(".") - 2 >>> 0) + 2);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename : function(req, file, cb) {
    let prefix = Date.now();
    if (req.body.title == '' || req.body.title  == null || req.body.title == undefined)
      cb(null, prefix + '-' + file.originalname)
    else
      cb(null, prefix + '-' + req.body.title + extension(file.originalname))
  }
})

let upload = multer({ storage: storage });

let db = require('../db');

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
    res.locals.files = files;
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

router.post('/', upload.single('fileupload'), function(req, res, next) {
  if (!req.file || Object.keys(req.file).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  db.run('INSERT INTO media (path) VALUES (?)', [req.file.filename], function (err) {
    if (err) return next(err);
    return res.redirect('/');
  })
});

router.post('/:id(\\d+)/delete', function(req, res, next) {
  db.all('SELECT path FROM media WHERE id = ?', [ req.params.id ], function(err, path) {
    if (err) { return next(err); }
    fs.unlink('uploads/' + path[0].path, (err => {
      if (err) console.log(err);
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
