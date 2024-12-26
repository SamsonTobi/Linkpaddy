import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AddFriends: React.FC = () => {
  const { currentUser, addFriend, searchUser } = useAuth();
  const [username, setUsername] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSearchResult(null);
    try {
      const user = await searchUser(username);
      if (user) {
        setSearchResult(user.username || '');
      } else {
        setError('User not found');
      }
    } catch (error) {
      setError('An error occurred while searching');
    }
  };

  const handleAddFriend = async () => {
    try {
      await addFriend(username);
      setSearchResult(null);
      setUsername('');
    } catch (error) {
      setError('Failed to add friend');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Add Friends</h2>
      <p className="mb-4">Your username: {currentUser?.username}</p>
      
      <form onSubmit={handleSearch} className="mb-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Search by username"
          className="w-full p-2 mb-2 border rounded"
        />
        <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded">
          Search
        </button>
      </form>

      {searchResult && (
        <div className="mb-4">
          <p>User found: {searchResult}</p>
          <button onClick={handleAddFriend} className="bg-green-500 text-white py-2 px-4 rounded mt-2">
            Add Friend
          </button>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default AddFriends;

