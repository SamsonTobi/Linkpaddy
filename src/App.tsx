import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { useAuth } from './contexts/AuthContext';
import { Loader } from 'lucide-react';
import Onboarding from './components/Onboarding';

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col gap-3 items-center justify-center h-full bg-white">
    <Loader className="w-12 h-12 text-gray-300 animate-spin" />
    <p className='font-medium outfit-medium'>Please hold on...</p>
  </div>
);

const AppContent: React.FC = () => {
  const { currentUser, isLoading, isNewUser } = useAuth();

  return (
    <div style={{ width: '450px', height: '550px' }}>
      {isLoading ? (
        <LoadingSpinner />
      ) : !currentUser ? (
        <Login />
      ) : isNewUser ? (
        <Onboarding />
      ) : (
        <Dashboard />
      )}
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

