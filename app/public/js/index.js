/* eslint-env browser: true */

function copyURI(evt) {
	evt.preventDefault();
	navigator.clipboard.writeText(absolutePath(evt.target.getAttribute("src"))).then(() => {
		/* clipboard successfully set */
		console.log("copied");
	}, () => {
		/* clipboard write failed */
		console.log("failed");
	});
}

function copyA(evt) {
	evt.preventDefault();
	navigator.clipboard.writeText(absolutePath(evt.target.getAttribute("href"))).then(() => {
		console.log("copied");
	}, () => {
		console.log("failed");
	});
}

function copyPath(evt) {
	navigator.clipboard.writeText(absolutePath(evt)).then(() => {
		console.log("copied");
	}, () => {
		console.log("failed");
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

["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
	dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults (e) {
	e.preventDefault();
	e.stopPropagation();
}

["dragenter", "dragover"].forEach(eventName => {
	dropArea.addEventListener(eventName, highlight, false);
})

;["dragleave", "drop"].forEach(eventName => {
	dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
	dropArea.classList.add("highlight");
}

function unhighlight(e) {
	dropArea.classList.remove("highlight");
}

dropArea.addEventListener("drop", handleDrop, false);
window.addEventListener("paste", handlePaste);

function handleDrop(e) {
	let dt = e.dataTransfer;
	let files = dt.files;
	handleFiles(files);
}

function handlePaste(e) {
	// Get the data of clipboard
	const clipboardItems = e.clipboardData.items;
	const items = [].slice.call(clipboardItems).filter(function (item) {
		// Filter the image items only
		return item.type.indexOf("image") !== -1;
	});
	if (items.length === 0) {
		return;
	}

	const item = items[0];
	// Get the blob of image
	const blob = item.getAsFile();
	console.log(blob);

	uploadFile(blob);
	previewFile(blob);
}

function handleFiles(files) {
	files = [...files];
	files.forEach(uploadFile);
	files.forEach(previewFile);
}


function previewFile(file) {
	let reader = new FileReader();
	reader.readAsDataURL(file);
	reader.onloadend = function() {
		let img = document.createElement("img");
		img.src = reader.result;
		img.className = "image";
		document.getElementById("gallery").appendChild(img);
		console.log(document.getElementById("fileupload"));
		document.getElementById("fileupload").src = img.src;
	};
}

function uploadFile(file) {
	let xhr = new XMLHttpRequest();
	let formData = new FormData();
	let reader = new FileReader();
  
	xhr.open("POST", "/", true);

	xhr.addEventListener("readystatechange", function(e) {
		if (xhr.readyState == 4 && xhr.status == 200) {
			location.reload();
		}
		else if (xhr.readyState == 4 && xhr.status != 200) {
			// Error. Inform the user
		}
	});

	if (file == null || file == undefined) {
		//file = reader.readAsDataURL(document.getElementById("fileupload").files[0]);
		//file = reader.readAsDataURL(document.querySelector("#fileupload").files[0]);
		file = document.querySelector("#fileupload").files[0];
	}

	formData.append("fileupload", file);
	formData.append("expire", document.getElementById("expire").value);
	console.log(formData);
	xhr.send(formData);
}

function openFullSize(imageUrl) {
	let modal = document.createElement("div");
	modal.classList.add("modal");
	let img = document.createElement("img");
	let video = document.createElement("video");
	img.src = imageUrl;
	video.src = imageUrl;
	video.controls = true;

	if (extension(imageUrl) == ".jpg" || extension(imageUrl) == ".png" || extension(imageUrl) == ".gif" || extension(imageUrl) == ".jpeg" || extension(imageUrl) == ".webp") {
		modal.appendChild(img);
	}
	else if (extension(imageUrl) == ".mp4" || extension(imageUrl) == ".webm" || extension(imageUrl) == ".mov") {
		modal.appendChild(video);
	}
  
	// Add the modal to the page
	document.body.appendChild(modal);
  
	// Add an event listener to close the modal when the user clicks on it
	modal.addEventListener('click', function() {
		modal.remove();
	});
}

function extension(string) {
	return string.slice((string.lastIndexOf(".") - 2 >>> 0) + 2);
}