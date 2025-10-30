import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ user, searchQuery, onSearchChange }) => {
  const isAdmin = user.username === 'admin';

  return (
    <header className="header">
      <h1>Embedder</h1>
      <nav className="nav">
        <ul className="left-ul">
          <li className="user">{user.username}</li>
          <li>
            <form action="/logout" method="post">
              <button className="logout" type="submit"></button>
            </form>
          </li>
          {isAdmin && (
            <li>
              <button
                className="adduser"
                onClick={() => (window.location.href = '/adduser')}
              ></button>
            </li>
          )}
        </ul>
        <form autoComplete="one-time-code" onSubmit={(e) => e.preventDefault()}>
          <input
            type="text"
            name="user"
            value={user.username}
            style={{ display: 'none' }}
            readOnly
          />
          <input
            autoComplete="one-time-code"
            type="text"
            id="search"
            name="search"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </form>
      </nav>
    </header>
  );
};
