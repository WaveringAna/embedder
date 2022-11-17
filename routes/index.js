let express = require('express');
let Busboy = require('busboy');

let db = require('../db');
let fs = require('fs');
let path = require('path');

function extension(str){
  let file = str.split('/').pop();
  return [file.substr(0,file.lastIndexOf('.')),file.substr(file.lastIndexOf('.'),file.length)]
}

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

router.post('/', function (req, res, next) {
  const bb = Busboy({ headers: req.headers });
  bb.on('file', function (name, file, info) {
    let saveTo = path.join('uploads', info.filename);
    if (fs.existsSync(saveTo)) {
      let suffix = new Date().getTime() / 1000;
      let nameAndExtension = extension(info.filename);
	
      saveTo = path.join('uploads', nameAndExtension[0] + '-' + suffix + nameAndExtension[1]);
      console.log('File already exists, renaming to ' + nameAndExtension[0] + '-' + suffix + nameAndExtension[1]);
      console.log('Saving to ' + saveTo);

      file.pipe(fs.createWriteStream(saveTo));
      db.run('INSERT INTO media (path) VALUES (?)', [nameAndExtension[0] + '-' + suffix + nameAndExtension[1]], function (err) {
        if (err) return next(err);
      });
     } else {
        console.log('Saving to ' + saveTo);

        file.pipe(fs.createWriteStream(saveTo));
        db.run('INSERT INTO media (path) VALUES (?)', [info.filename], function (err) {
          if (err) return next(err);
        });
      }
    bb.on('close', function () {
      res.redirect('/');
    });
  });
  req.pipe(bb);
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
