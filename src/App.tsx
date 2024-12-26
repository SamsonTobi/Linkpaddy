import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { useAuth } from './contexts/AuthContext';

const AppContent: React.FC = () => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ width: '300px', height: '400px', padding: '20px', backgroundColor: '#f0f0f0', overflowY: 'auto' }}>
      {!currentUser ? <Login /> : <Dashboard />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

