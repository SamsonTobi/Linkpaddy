import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { currentUser, signIn, isLoading, error } = useAuth();

  if (currentUser) {
    return null;
  }

  return (
    <div>
      <h2>Welcome to Link Sharing Extension</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={signIn} disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
      </button>
    </div>
  );
};

export default Login;

