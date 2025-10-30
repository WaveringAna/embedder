import React, { useEffect, useRef } from 'react';
import { MediaFile, ProgressUpdate } from '../types';
import { getMediaType, sanitizeId, copyToClipboard, absolutePath } from '../utils/helpers';

interface MediaItemProps {
  file: MediaFile;
  processVideo: boolean;
  progressData?: ProgressUpdate;
  onDelete: (id: number) => void;
}

export const MediaItem: React.FC<MediaItemProps> = ({
  file,
  processVideo,
  progressData,
  onDelete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sanitizedFilename = sanitizeId(file.path);
  const mediaType = getMediaType(file.path);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (videoRef.current) {
          if (entry.isIntersecting && videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          } else if (!entry.isIntersecting && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }
      },
      { threshold: 0.25 }
    );

    const element = videoRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, []);

  const isProcessing = processVideo && mediaType === 'video' && !file.isProcessed;
  const showSpinner = isProcessing && progressData?.status !== 'complete';
  const progress = progressData?.progress || 0;

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    copyToClipboard(absolutePath(`/uploads/${file.path}`));
  };

  const handleCopyGifvUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    copyToClipboard(absolutePath(`/gifv/${file.path}`));
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm('Are you sure you want to delete this file?')) {
      onDelete(file.id);
    }
  };

  const openFullSize = () => {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const element =
      mediaType === 'video'
        ? `<video src="/uploads/${file.path}" controls></video>`
        : `<img src="/uploads/${file.path}">`;

    modal.innerHTML = element;
    document.body.appendChild(modal);

    modal.addEventListener('click', () => modal.remove());
  };

  const renderMedia = () => {
    if (mediaType === 'video') {
      return (
        <video
          ref={videoRef}
          className="image"
          autoPlay
          loop
          muted
          playsInline
          onClick={openFullSize}
        >
          <source src={`/uploads/${file.path}`} type={`video/${file.path.split('.').pop()}`} />
        </video>
      );
    } else if (mediaType === 'image') {
      return (
        <img
          src={`/uploads/${file.path}`}
          alt={file.path}
          className="image"
          onClick={openFullSize}
        />
      );
    } else {
      const extension = file.path.split('.').pop()?.toUpperCase() || 'FILE';
      return (
        <div className="nonmedia">
          <p>{extension} file</p>
        </div>
      );
    }
  };

  return (
    <li id={file.path}>
      <div className="view">
        <div className="media-wrapper">
          {showSpinner ? (
            <div
              id={`spinner-${sanitizedFilename}`}
              className="spinner"
            >
              Optimizing Video for Sharing: {(progress * 100).toFixed(2)}%
            </div>
          ) : (
            <>
              <div
                id={`media-container-${sanitizedFilename}`}
                style={{ display: 'block' }}
              >
                {renderMedia()}
              </div>
              <div className="media-actions-overlay">
                {mediaType === 'video' && (
                  <button onClick={handleCopyGifvUrl} className="overlay-btn gifv-btn" title="Copy as GIFv">
                    Copy as GIFv
                  </button>
                )}
                <button onClick={handleDelete} className="overlay-btn delete-btn" title="Delete">
                  ×
                </button>
              </div>
            </>
          )}
        </div>
        <label>
          <a href={file.url} onClick={handleCopyUrl}>
            {file.path}
          </a>
        </label>
        {file.expire && (
          <div className="expire-date">
            Expires: {new Date(file.expire).toLocaleString()}
          </div>
        )}
      </div>
    </li>
  );
};
