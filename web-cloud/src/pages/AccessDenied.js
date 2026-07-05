import React from 'react';
import './AccessDenied.css';

const AccessDenied = () => {
  return (
    <div className="access-denied-container">
      <svg className="lock-icon" viewBox="0 0 24 24">
        <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM8.5 6c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5v2h-7V6z"/>
      </svg>
      <h1>Access Denied</h1>
      <p>You do not have permission to view this page. Please contact the administrator if you believe this is an error.</p>
      <a href="/" className="btn">Return to Homepage</a>
    </div>
  );
};

export default AccessDenied;