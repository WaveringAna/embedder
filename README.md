# Embedder

A media host specialized in good looking embeds for services like Discord

<img src="readmegif.gif">

## Run

Source:
```Bash
EBPASS=changeme
EBPORT=3000
EBSECRET=4jkdmakl2l #jwt session secret

$ npm install
$ node db.js
$ npm start
```

Docker
```
docker build . -t embedder
docker run -d -p "4000:4000" -e EBPORT=4000 -e EBPASS=pass -e EBSECRET=4jkdmakl2l embedder
```

## License

[The Unlicense](https://opensource.org/licenses/unlicense)
