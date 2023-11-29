/* eslint-disable no-undef */
/* eslint-env browser: true */

let files;

function copyURI(evt) {
  evt.preventDefault();
  navigator.clipboard
    .writeText(absolutePath(evt.target.getAttribute("src")))
    .then(
      () => {
        /* clipboard successfully set */
        console.log("copied");
      },
      () => {
        /* clipboard write failed */
        console.log("failed");
      }
    );
}

function copyA(evt) {
  evt.preventDefault();
  navigator.clipboard
    .writeText(absolutePath(evt.target.getAttribute("href")))
    .then(
      () => {
        console.log("copied");
      },
      () => {
        console.log("failed");
      }
    );
}

function copyPath(evt) {
  navigator.clipboard.writeText(absolutePath(evt)).then(
    () => {
      console.log("copied");
    },
    () => {
      console.log("failed");
    }
  );
}

function absolutePath(href) {
  let link = document.createElement("a");
  link.href = href;
  return link.href;
}

function extension(string) {
  return string.slice(((string.lastIndexOf(".") - 2) >>> 0) + 2);
}

let dropArea = document.getElementById("dropArea");

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, highlight, false);
});
["dragleave", "drop"].forEach((eventName) => {
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
  reader.onloadend = function () {
    let img = document.createElement("img");
    img.src = reader.result;
    img.className = "image";
    document.getElementById("gallery").appendChild(img);
    document.getElementById("fileupload").src = img.src;
  };
}

function uploadFile(file) {
  let xhr = new XMLHttpRequest();
  let formData = new FormData();
  let reader = new FileReader();

  xhr.open("POST", "/", true);

  xhr.addEventListener("readystatechange", function (e) {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        let response = xhr.responseText;
        //document.getElementById("embedder-list").innerHTML = response;
        htmx.ajax("GET", "/media-list", {target: "#embedder-list", swap: "innerHTML"});
        document.getElementById("gallery").innerHTML = "";
        htmx.process(document.body);
      } else {
        alert(`Upload failed, error code: ${xhr.status}`);
      }
    }
  });

  if (file == null || file == undefined) {
    file = document.querySelector("#fileupload").files[0];
  }

  formData.append("fileupload", file);
  formData.append("expire", document.getElementById("expire").value);
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

  if (
    extension(imageUrl) == ".jpg" ||
    extension(imageUrl) == ".png" ||
    extension(imageUrl) == ".gif" ||
    extension(imageUrl) == ".jpeg" ||
    extension(imageUrl) == ".webp"
  ) {
    modal.appendChild(img);
  } else if (
    extension(imageUrl) == ".mp4" ||
    extension(imageUrl) == ".webm" ||
    extension(imageUrl) == ".mov"
  ) {
    modal.appendChild(video);
  }

  // Add the modal to the page
  document.body.appendChild(modal);

  // Add an event listener to close the modal when the user clicks on it
  modal.addEventListener("click", function () {
    modal.remove();
  });
}

let searchInput = document.getElementById("search");

searchInput.addEventListener("input", () => {
  let searchValue = searchInput.value;
  let mediaList = document.querySelectorAll("ul.embedder-list li");

  mediaList.forEach((li) => {
    if (!li.id.toLowerCase().includes(searchValue)) {
      //make lowercase to allow case insensitivity
      li.classList.add("hide");
      li.classList.remove("show");
      li.addEventListener(
        "animationend",
        function () {
          if (searchInput.value !== "") {
            this.style.display = "none";
          }
        },
        { once: true }
      ); // The {once: true} option automatically removes the event listener after it has been called
    } else {
      li.style.display = "";
      li.classList.remove("hide");
      if (searchValue === "" && !li.classList.contains("show")) {
        li.classList.add("show");
      }
    }
  });
});

function checkFileAvailability(filePath) {
  const checkFile = () => {
    console.log(`Checking if ${filePath} is processed...`);
    fetch(`/uploads/${filePath}-progress.json`)
      .then((response) => {
        if (response.ok) {
          console.log(`${filePath} still processing`);
          return response.json();
        } else {
          console.log(`${filePath} finished processing`);
          console.log(`/uploads/720p-${filePath}-progress.json finished`);
          clearInterval(interval);
          createVideoElement(filePath);
          return;
        }
      })
      .then((jsonData) => {
        // Handle your JSON data here
        console.log(jsonData);
      })
      .catch((error) => console.error("Error:", error));
  };

  checkFile();
  const interval = setInterval(checkFile, 5000);
}

function createVideoElement(filePath) {
  const videoContainer = document.getElementById(`video-${filePath}`);
  videoContainer.outerHTML = `
    <video id='video-${filePath}' class="image" autoplay loop muted playsinline loading="lazy">
      <source src="/uploads/720p-${filePath}" loading="lazy">
    </video>
  `;
  videoContainer.style.display = "block";
  document.getElementById(`spinner-${filePath}`).style.display = "none";
}

async function updateMediaList() {
  try {
    const response = await fetch("/media-list");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.text();

    document.getElementById("embedder-list").innerHTML = data;
    htmx.process(document.body);
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}

function refreshMediaList(files) {
  files.forEach(file => {
    console.log(`Checking ${file.path}...`);
    if (videoExtensions.includes(extension(file.path))) {
      const progressFileName = `uploads/${file.path}-progress.json`;
      console.log(`Fetching ${progressFileName}...`);
      checkFileAvailability(file.path);
    } else {
      console.log(`File ${file.path} is not a video, displaying...`);
    }
  });
}

const videoExtensions = [
  ".mp4",
  ".mov",
  ".avi",
  ".flv",
  ".mkv",
  ".wmv",
  ".webm",
];
const imageExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".svg",
  ".tiff",
  ".webp",
];