import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { useAuth } from './contexts/AuthContext';
import { Loader } from 'lucide-react';

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-full bg-white">
    <Loader className="w-12 h-12 text-[#6C5CE7] animate-spin" />
  </div>
);

const AppContent: React.FC = () => {
  const { currentUser, isLoading } = useAuth();

  return (
    <div style={{ width: '450px', height: '550px' }}>
      {isLoading ? <LoadingSpinner /> : !currentUser ? <Login /> : <Dashboard />}
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

