import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Search, UserPlus } from 'lucide-react';

interface AddFriendProps {
  onBack: () => void;
}

const AddFriend: React.FC<AddFriendProps> = ({ onBack }) => {
  const { searchUser, addFriend } = useAuth();
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
      onBack();
    } catch (error) {
      setError('Failed to add friend');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-4 p-4 border-b">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold">Add New Friend</h2>
      </div>

      <div className="p-4 flex-1">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Search by username"
              className="w-full p-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#6C5CE7]"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </form>

        {searchResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="font-medium">User found: {searchResult}</p>
            <button
              onClick={handleAddFriend}
              className="mt-2 w-full bg-[#6C5CE7] text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Friend
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-red-500">{error}</p>}
      </div>
    </div>
  );
};

export default AddFriend;

