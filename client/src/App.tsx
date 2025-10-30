import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUploader } from './components/FileUploader';
import { MediaList } from './components/MediaList';
import { User } from './types';
import './App.css';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [processVideo, setProcessVideo] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial user and config data
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');

        if (response.status === 401) {
          // User is not authenticated, redirect to login
          window.location.href = '/login';
          return;
        }

        if (!response.ok) throw new Error('Failed to fetch config');

        const data = await response.json();
        setUser(data.user);
        setProcessVideo(data.processVideo);
      } catch (error) {
        console.error('Error fetching config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleUploadComplete = () => {
    // Trigger a refresh of the media list
    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <div className="error">Failed to load user data</div>;
  }

  return (
    <div>
      <section className="embedderapp">
        <Header user={user} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <FileUploader onUploadComplete={handleUploadComplete} />
        <section className="main">
          <MediaList processVideo={processVideo} refreshTrigger={refreshTrigger} />
        </section>
      </section>
      <footer className="info">
        <p>
          <a href="https://l.nekomimi.pet/project">Created by Wavering Ana</a>
        </p>
        <p>
          <a href="https://github.com/WaveringAna/Embedder">Github</a>
        </p>
      </footer>
    </div>
  );
};
