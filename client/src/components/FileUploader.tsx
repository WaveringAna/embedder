import React, { useState, useRef, useCallback } from 'react';

interface FileUploaderProps {
  onUploadComplete: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [expire, setExpire] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      formData.append('fileupload', file);
      formData.append('expire', expire);

      setIsUploading(true);
      setUploadProgress(0);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          setUploadProgress(percent);
        }
      });

      xhr.upload.addEventListener('load', () => {
        console.log('Upload completed for', file.name);
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          setIsUploading(false);
          setUploadProgress(0);

          if (xhr.status === 200) {
            console.log('Server returned success for', file.name);
            onUploadComplete();
            resolve();
          } else {
            const msg = `Upload failed: ${xhr.status} - ${xhr.responseText}`;
            console.error(msg);
            alert(msg);
            reject(new Error(msg));
          }
        }
      };

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  }, [expire, onUploadComplete]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const filesArray = Array.from(files);
    for (const file of filesArray) {
      await uploadFile(file);
    }
  }, [uploadFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
      .filter(item => item.type.indexOf('image') !== -1);

    if (items.length) {
      const file = items[0].getAsFile();
      if (file) {
        uploadFile(file);
      }
    }
  }, [uploadFile]);

  React.useEffect(() => {
    window.addEventListener('paste', handlePaste as any);
    return () => {
      window.removeEventListener('paste', handlePaste as any);
    };
  }, [handlePaste]);

  const handleManualUpload = () => {
    if (fileInputRef.current?.files?.length) {
      handleFiles(fileInputRef.current.files);
    }
  };

  return (
    <div>
      <div
        id="dropArea"
        ref={dropAreaRef}
        className={isDragging ? 'highlight' : ''}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="dragregion">Upload a file, copy paste, or drag n' drop into the dashed region</p>
        <div id="gallery"></div>
        <p className="dragregion">
          <input
            type="file"
            id="fileupload"
            name="fileupload"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            type="button"
            value="Upload"
            id="submit"
            onClick={handleManualUpload}
          />
        </p>
        <br />
        <br />
        <p className="dragregion">
          Select file expiration date:
          <select
            name="expire"
            id="expire"
            value={expire}
            onChange={(e) => setExpire(e.target.value)}
          >
            <option value="0.00069">1 minute</option>
            <option value="0.00347">5 minutes</option>
            <option value="0.0417">1 hour</option>
            <option value="0.25">6 hours</option>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="">never</option>
          </select>
        </p>
        <p className="dragregion">Click the file to copy the url</p>
      </div>
      {isUploading && (
        <div id="uploadProgressContainer">
          <p>Uploading: <span id="uploadPercent">{uploadProgress.toFixed(1)}%</span></p>
          <div style={{ width: '100%', background: '#333' }}>
            <div
              id="uploadBar"
              style={{
                width: `${uploadProgress}%`,
                height: '8px',
                background: '#c00',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
