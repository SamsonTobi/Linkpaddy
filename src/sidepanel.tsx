import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import { AppContent } from './App';
import './index.css';

// Dedicated side-panel entry: same app as the popup, but fluid so it
// never grows beyond the native panel width Chrome provides.
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <div style={{ width: '100%', minHeight: '100vh', margin: '0 auto', overflowX: 'hidden' }}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </div>
    </React.StrictMode>
  );
} else {
  console.error('Root element not found');
}
