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
        this.CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
        this.LARGE_FILE_THRESHOLD = 20 * 1024 * 1024; // 20MB
        this.MAX_CHUNK_RETRIES = 3;

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
        const expire = document.getElementById('expire').value;
        const container = document.getElementById('uploadProgressContainer');
        const percentElem = document.getElementById('uploadPercent');
        const barElem = document.getElementById('uploadBar');

        // Show progress UI
        container.style.display = 'block';
        barElem.style.width = '0%';
        percentElem.textContent = '0%';

        if (file.size > this.LARGE_FILE_THRESHOLD) {
            console.log(`File ${file.name} is large, using chunked upload.`);
            try {
                await this.uploadFileInChunks(file, expire, percentElem, barElem);
                // Success message or UI update for chunked upload completion is handled in finalize
            } catch (error) {
                console.error(`Chunked upload failed for ${file.name}:`, error);
                alert(`Upload failed for ${file.name}: ${error.message}`);
                // Hide progress bar on error
                container.style.display = 'none';
                barElem.style.width = '0%';
                percentElem.textContent = '0%';
                throw error; // Re-throw to be caught by handleFiles if necessary
            }
        } else {
            console.log(`File ${file.name} is small, using direct upload.`);
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const formData = new FormData();

                formData.append('fileupload', file);
                formData.append('expire', expire);

                xhr.upload.addEventListener('progress', e => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 100;
                        percentElem.textContent = percent.toFixed(1) + '%';
                        barElem.style.width = percent + '%';
                    }
                });

                xhr.upload.addEventListener('load', () => {
                    console.log('Direct upload completed for', file.name);
                });

                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        // Hide & reset progress bar
                        container.style.display = 'none';
                        barElem.style.width = '0%';
                        percentElem.textContent = '0%';

                        if (xhr.status === 200) {
                            console.log('Server returned success for direct upload:', file.name);
                            document.getElementById('embedder-list').innerHTML = xhr.responseText;
                            htmx.process(document.getElementById('embedder-list'));
                            this.gallery.innerHTML = '';
                            resolve();
                        } else {
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

    async uploadFileInChunks(file, expire, percentElem, barElem) {
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
        console.log(`Uploading ${file.name} in ${totalChunks} chunks of size ${this.CHUNK_SIZE} bytes.`);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * this.CHUNK_SIZE;
            const end = Math.min(start + this.CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('chunk', chunk, file.name); // file.name for the blob
            formData.append('originalFilename', file.name);
            formData.append('chunkIndex', String(chunkIndex));
            formData.append('totalChunks', String(totalChunks));
            // 'expire' is not sent with chunks, but with /complete

            let retries = 0;
            let success = false;
            while (retries < this.MAX_CHUNK_RETRIES && !success) {
                try {
                    console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks} for ${file.name} (Attempt ${retries + 1})`);
                    const response = await fetch('/upload/chunk', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorData = await response.text();
                        throw new Error(`Chunk upload failed: ${response.status} - ${errorData}`);
                    }
                    
                    const result = await response.json();
                    console.log(`Chunk ${result.chunkIndex} uploaded successfully for ${result.originalFilename}`);
                    success = true;
                } catch (error) {
                    retries++;
                    console.error(`Error uploading chunk ${chunkIndex} for ${file.name}, attempt ${retries}:`, error);
                    if (retries >= this.MAX_CHUNK_RETRIES) {
                        throw new Error(`Failed to upload chunk ${chunkIndex} for ${file.name} after ${this.MAX_CHUNK_RETRIES} attempts. Error: ${error.message}`);
                    }
                    // Optional: Add a small delay before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
            }
            // Update progress after each chunk
            const percent = ((chunkIndex + 1) / totalChunks) * 100;
            percentElem.textContent = percent.toFixed(1) + '%';
            barElem.style.width = percent + '%';
        }

        // All chunks uploaded, finalize
        console.log(`All chunks uploaded for ${file.name}. Finalizing...`);
        await this.finalizeChunkedUpload(file.name, totalChunks, expire);
    }

    async finalizeChunkedUpload(originalFilename, totalChunks, expire) {
        const formData = new FormData();
        formData.append('originalFilename', originalFilename);
        formData.append('totalChunks', String(totalChunks));
        formData.append('expire', expire); // Send expire with the completion request

        try {
            const response = await fetch('/upload/complete', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Finalization failed: ${response.status} - ${errorData}`);
            }

            // Success, update UI
            const responseText = await response.text();
            document.getElementById('embedder-list').innerHTML = responseText;
            htmx.process(document.getElementById('embedder-list'));
            this.gallery.innerHTML = ''; // Clear any "preview"
            
            // Hide progress bar elements after successful completion
            const container = document.getElementById('uploadProgressContainer');
            const barElem = document.getElementById('uploadBar');
            const percentElem = document.getElementById('uploadPercent');
            if (container) container.style.display = 'none';
            if (barElem) barElem.style.width = '0%';
            if (percentElem) percentElem.textContent = '0%';

            console.log(`File ${originalFilename} successfully uploaded and processed.`);

        } catch (error) {
            console.error(`Error finalizing upload for ${originalFilename}:`, error);
            alert(`Failed to finalize upload for ${originalFilename}: ${error.message}`);
            throw error; // Re-throw for higher level handling if needed
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new FileUploader();

    // Setup search functionality
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            const searchValue = e.target.value.toLowerCase();
            const mediaItems = document.querySelectorAll('ul.embedder-list li');

            mediaItems.forEach(item => {
                const matches = item.id.toLowerCase().includes(searchValue);
                item.classList.toggle('hide', !matches);
                item.classList.toggle('show', matches);

                item.addEventListener('animationend', function handler() {
                    if (!matches && searchValue !== '') {
                        this.style.display = 'none';
                    }
                    this.removeEventListener('animationend', handler);
                });
            });
        });
    }
});

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