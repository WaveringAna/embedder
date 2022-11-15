function copyURI(evt) {
	evt.preventDefault();
    navigator.clipboard.writeText(absolutePath(evt.target.getAttribute('src'))).then(() => {
      /* clipboard successfully set */
      console.log("copied")
    }, () => {
      /* clipboard write failed */
      console.log("failed")
    });
}

function absolutePath (href) {
	let link = document.createElement("a");
	link.href = href;
	return link.href;
}

function extension(string) {
  return string.slice((string.lastIndexOf(".") - 2 >>> 0) + 2);
}

let dropArea = document.getElementById("dropArea");

;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false)
})

function preventDefaults (e) {
  e.preventDefault()
  e.stopPropagation()
}

;['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, highlight, false)
})

;['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, unhighlight, false)
})

function highlight(e) {
  dropArea.classList.add('highlight')
}

function unhighlight(e) {
  dropArea.classList.remove('highlight')
}

dropArea.addEventListener('drop', handleDrop, false)

function handleDrop(e) {
  let dt = e.dataTransfer
  let files = dt.files
  handleFiles(files)
}

function handleFiles(files) {
  files = [...files]
  files.forEach(uploadFile)
  files.forEach(previewFile)
}


function previewFile(file) {
  let reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onloadend = function() {
    let img = document.createElement('img');
    img.src = reader.result
    img.className = "image";
    document.getElementById('gallery').appendChild(img)
    console.log(document.getElementById('fileupload'))
    document.getElementById('fileupload').src = img.src;
  }
}

function uploadFile(file) {
  let xhr = new XMLHttpRequest();
  let formData = new FormData();
  xhr.open('POST', '/', true);

  xhr.addEventListener('readystatechange', function(e) {
    if (xhr.readyState == 4 && xhr.status == 200) {
      location.reload();
    }
    else if (xhr.readyState == 4 && xhr.status != 200) {
      // Error. Inform the user
    }
  })

  formData.append('fileupload', file);
  xhr.send(formData)
}
