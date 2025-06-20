/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-env browser: true */

const MEDIA_TYPES = {
    video: ['.mp4', '.mov', '.avi', '.flv', '.mkv', '.wmv', '.webm'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.tiff', '.webp']
};

const getFileExtension = filename => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';
};

const getMediaType = filename => {
    const ext = getFileExtension(filename);
    if (MEDIA_TYPES.video.includes(ext)) return 'video';
    if (MEDIA_TYPES.image.includes(ext)) return 'image';
    return 'other';
};

class FileUploader {
    constructor() {
        this.dropArea = document.getElementById('dropArea');
        this.gallery = document.getElementById('gallery');
        this.setupEventListeners();
        // Only set up SSE if we're processing videos
        if (document.body.dataset.processVideo === 'true') {
            this.setupProgressUpdates();
        }
    }

    setupEventListeners() {
        // Drag and drop handlers
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, () =>
                this.dropArea.classList.add('highlight'));
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, () =>
                this.dropArea.classList.remove('highlight'));
        });

        // Handle file drops
        this.dropArea.addEventListener('drop', e =>
            this.handleFiles(e.dataTransfer.files));

        // Handle paste events
        window.addEventListener('paste', e => this.handlePaste(e));

        // Manual file selection
        document.getElementById('fileupload')
            .addEventListener('change', e => this.handleFiles(e.target.files));

        // Manual upload button
        document.getElementById('submit')
            .addEventListener('click', () => this.uploadSelectedFiles());
    }

    setupProgressUpdates() {
        console.log("Setting up SSE connection...");
        const evtSource = new EventSource('/progress-updates');

        evtSource.onopen = () => {
            console.log("SSE connection established");
        };

        evtSource.onmessage = event => {
            console.log("Raw SSE data:", event.data);
            const data = JSON.parse(event.data);

            if (data.type === 'connected') {
                console.log("Initial connection established");
                return;
            }

            const { filename, progress, status } = data;
            const sanitizedFilename = sanitizeId(filename);

            const spinnerElement = document.getElementById(`spinner-${sanitizedFilename}`);
            const containerElement = document.getElementById(`media-container-${sanitizedFilename}`);

            if (!spinnerElement || !containerElement) {
                console.warn("SSE: Could not find required elements for:", filename);
                return;
            }

            if (status === 'complete') {
                console.log("Processing complete:", filename);
                spinnerElement.style.display = 'none';
                containerElement.style.display = 'block';
            } else if (status === 'processing') {
                spinnerElement.textContent =
                    `Optimizing Video for Sharing: ${(progress * 100).toFixed(2)}%`;
            }
        };

        evtSource.onerror = (err) => {
            console.error("SSE Error:", err);
        };
    }

    async handleFiles(files) {
        const filesArray = [...files];
        for (const file of filesArray) {
            await this.uploadFileWithProgress(file);
        }
    }

    handlePaste(e) {
        const items = [...e.clipboardData.items]
            .filter(item => item.type.indexOf('image') !== -1);
        if (items.length) {
            const file = items[0].getAsFile();
            this.uploadFileWithProgress(file);
        }
    }

    uploadSelectedFiles() {
        const fileInput = document.getElementById('fileupload');
        if (fileInput.files.length) {
            this.handleFiles(fileInput.files);
        }
    }

    async uploadFileWithProgress(file) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();

            formData.append('fileupload', file);
            formData.append('expire', document.getElementById('expire').value);

            // Show the progress UI
            const container = document.getElementById('uploadProgressContainer');
            const percentElem = document.getElementById('uploadPercent');
            const barElem = document.getElementById('uploadBar');
            container.style.display = 'block';

            // Upload progress event
            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    percentElem.textContent = percent.toFixed(1) + '%';
                    barElem.style.width = percent + '%';
                }
            });

            xhr.upload.addEventListener('load', () => {
                console.log('Upload completed for', file.name);
            });

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        // We got a success from the server, rerender the file list
                        console.log('Server returned success for', file.name);

                        // Hide & reset progress bar
                        container.style.display = 'none';
                        barElem.style.width = '0%';
                        percentElem.textContent = '0%';

                        // Insert updated partial into #embedder-list
                        document.getElementById('embedder-list').innerHTML = xhr.responseText;
                        htmx.process(document.getElementById('embedder-list'));

                        // Clear any preview in the gallery
                        this.gallery.innerHTML = '';

                        resolve();
                    } else {
                        // Some error from the server
                        const msg = `Upload failed: ${xhr.status} - ${xhr.responseText}`;
                        console.error(msg);
                        alert(msg);
                        reject(new Error(msg));
                    }
                }
            };

            xhr.open('POST', '/');
            xhr.send(formData);
        });
    }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    new FileUploader();

    // Setup search functionality
    const searchInput = document.getElementById("search");
    const embedderList = document.getElementById('embedder-list');
    if (searchInput && embedderList) {
        // Handle animation end once via event delegation
        embedderList.addEventListener("animationend", event => {
            const item = event.target.closest("li");
            if (!item) return;
            // When the hide animation finishes keep the item out of flow
            if (item.classList.contains("hide")) {
                item.style.display = "none";
            }
        });

        searchInput.addEventListener("input", e => {
            const searchValue = e.target.value.toLowerCase();
            const mediaItems = embedderList.querySelectorAll("li");
            mediaItems.forEach(item => {
                const matches = item.id.toLowerCase().includes(searchValue);

                // Always reset display so animations have effect
                item.style.display = "block";
                // Toggle animation classes
                item.classList.toggle("hide", !matches);
                item.classList.toggle("show", matches);
            });
        });
    }
});

// Lazily pause / play videos depending on visibility
function setupLazyVideoPause() {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const video = entry.target;
            if (!video) return;
            if (entry.isIntersecting) {
                // Resume playback when in view
                if (video.paused) {
                    video.play().catch(() => {});
                }
            } else {
                // Pause when out of view
                if (!video.paused) {
                    video.pause();
                }
            }
        });
    }, { threshold: 0.25 });

    const observeVideos = () => {
        document.querySelectorAll("video.image, .video-container video").forEach(v => observer.observe(v));
    };

    // Initial observation
    observeVideos();

    // Observe future videos added via htmx swaps
    document.body.addEventListener("htmx:afterSettle", observeVideos);
}

// Kick off lazy video observer after everything loads
document.addEventListener("DOMContentLoaded", setupLazyVideoPause);

// Utility functions for the media list
window.copyURI = e => {
    e.preventDefault();
    navigator.clipboard.writeText(absolutePath(e.target.getAttribute('src')))
        .then(() => console.log('Copied to clipboard'))
        .catch(err => console.error('Copy failed:', err));
};

window.copyA = e => {
    e.preventDefault();
    navigator.clipboard.writeText(absolutePath(e.target.getAttribute('href')))
        .then(() => console.log('Copied to clipboard'))
        .catch(err => console.error('Copy failed:', err));
};

window.copyPath = evt => {
    navigator.clipboard.writeText(absolutePath(evt))
        .then(() => console.log('Copied to clipboard'))
        .catch(err => console.error('Copy failed:', err));
};

window.absolutePath = href => {
    const link = document.createElement('a');
    link.href = href;
    return link.href;
};

window.openFullSize = imageUrl => {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const mediaType = getMediaType(imageUrl);
    const element = mediaType === 'video'
        ? `<video src="${imageUrl}" controls></video>`
        : `<img src="${imageUrl}">`;

    modal.innerHTML = element;
    document.body.appendChild(modal);

    modal.addEventListener('click', () => modal.remove());
};

window.copyOriginalGifUrl = function(filePath) {
    const url = absolutePath('/uploads/' + filePath);
    navigator.clipboard.writeText(url)
        .then(() => console.log('Copied original GIF URL to clipboard'))
        .catch(err => console.error('Copy failed:', err));
};

function sanitizeId(filename) {
    return filename.replace(/[^a-z0-9]/gi, '_');
}