import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AddFriends from './AddFriends';

const Dashboard: React.FC = () => {
  const { currentUser, signOut } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Welcome, {currentUser.displayName || currentUser.email}</h2>
      <p className="mb-2">Your username: {currentUser.username}</p>
      <h3 className="text-lg font-semibold mb-2">Your Friends:</h3>
      {currentUser.friends && currentUser.friends.length > 0 ? (
        <ul className="mb-4">
          {currentUser.friends.map((friend, index) => (
            <li key={index}>{friend}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-4">You haven't added any friends yet.</p>
      )}
      <button 
        onClick={() => setShowAddFriends(!showAddFriends)} 
        className="bg-blue-500 text-white py-2 px-4 rounded mr-2"
      >
        {showAddFriends ? 'Hide Add Friends' : 'Add Friends'}
      </button>
      <button onClick={signOut} className="bg-red-500 text-white py-2 px-4 rounded">Sign out</button>
      
      {showAddFriends && <AddFriends />}
    </div>
  );
};

export default Dashboard;

