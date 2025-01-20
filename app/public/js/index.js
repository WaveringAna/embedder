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
        this.setupProgressUpdates();
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

        // Handle manual file selection
        document.getElementById('fileupload')
            .addEventListener('change', e => this.handleFiles(e.target.files));

        // Handle manual upload button
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

            console.log("Looking for elements:", {
                spinnerSelector: `spinner-${sanitizedFilename}`,
                containerSelector: `media-container-${sanitizedFilename}`,
            });

            const spinnerElement = document.getElementById(`spinner-${sanitizedFilename}`);
            const containerElement = document.getElementById(`media-container-${sanitizedFilename}`);

            if (!spinnerElement || !containerElement) {
                console.warn("Could not find required elements for:", filename);
                return;
            }

            if (status === 'complete') {
                console.log("Processing complete, showing video for:", filename);
                spinnerElement.style.display = 'none';
                containerElement.style.display = 'block';
            } else if (status === 'processing') {
                console.log("Updating progress for:", filename);
                spinnerElement.textContent =
                    `Optimizing Video for Sharing: ${(progress * 100).toFixed(2)}% done`;
            }
        };

        evtSource.onerror = (err) => {
            console.error("SSE Error:", err);
        };
    }

    async handleFiles(files) {
        const filesArray = [...files];
        for (const file of filesArray) {
            await this.uploadFile(file);
        }
    }

    handlePaste(e) {
        const items = [...e.clipboardData.items]
            .filter(item => item.type.indexOf('image') !== -1);

        if (items.length) {
            const file = items[0].getAsFile();
            this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('fileupload', file);
        formData.append('expire', document.getElementById('expire').value);

        try {
            const response = await fetch('/', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

            // Get the new file list HTML and insert it
            const listResponse = await fetch('/media-list');
            const html = await listResponse.text();
            document.getElementById('embedder-list').innerHTML = html;

            // Clear preview
            this.gallery.innerHTML = '';

        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed: ' + error.message);
        }
    }

    uploadSelectedFiles() {
        const fileInput = document.getElementById('fileupload');
        if (fileInput.files.length) {
            this.handleFiles(fileInput.files);
        }
    }

    showMediaElement(filename) {
        const container = document.getElementById(`media-container-${filename}`);
        const spinner = document.getElementById(`spinner-${filename}`);

        if (container && spinner) {
            const mediaType = getMediaType(filename);

            if (mediaType === 'video') {
                container.innerHTML = `
                    <video class="image" autoplay loop muted playsinline>
                        <source src="/uploads/720p-${filename}">
                    </video>`;
            }

            spinner.style.display = 'none';
            container.style.display = 'block';
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

function sanitizeId(filename) {
    return filename.replace(/[^a-z0-9]/gi, '_');
}