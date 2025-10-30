import React, { useState, useEffect } from 'react';
import { MediaFile, ProgressUpdate } from '../types';
import { MediaItem } from './MediaItem';
import { useSSE } from '../hooks/useSSE';

interface MediaListProps {
  processVideo: boolean;
  refreshTrigger: number;
}

export const MediaList: React.FC<MediaListProps> = ({ processVideo, refreshTrigger }) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressUpdate>>(new Map());

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/media-list');
      if (!response.ok) throw new Error('Failed to fetch media');
      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [refreshTrigger]);

  const handleProgressUpdate = (update: ProgressUpdate) => {
    console.log('[MediaList] Progress update received:', update);
    setProgressMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(update.filename, update);

      // If complete, refresh the file list after a short delay
      if (update.status === 'complete') {
        setTimeout(() => {
          fetchFiles();
        }, 500);
      }

      return newMap;
    });
  };

  useSSE({
    onMessage: handleProgressUpdate,
    onError: (error) => console.error('[MediaList] SSE error:', error),
    onOpen: () => console.log('[MediaList] SSE connection opened'),
    enabled: processVideo,
  });

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/${id}/delete`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete file');

      // Refresh the file list
      await fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  if (loading) {
    return <div className="loading">Loading media...</div>;
  }

  return (
    <ul id="embedder-list" className="embedder-list">
      {files.length === 0 ? (
        <li className="no-files">No files found</li>
      ) : (
        files.map((file) => (
            <MediaItem
              key={file.id}
              file={file}
              processVideo={processVideo}
              progressData={progressMap.get(file.path)}
              onDelete={handleDelete}
            />
        ))
      )}
    </ul>
  );
};
