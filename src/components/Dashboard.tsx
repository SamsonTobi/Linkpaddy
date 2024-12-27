import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link2, Users, Share2, Eye, EyeOff, Settings, Share, UserMinus, UserPlus } from 'lucide-react';
import ShareLink from './ShareLink';
import SettingsComponent from './Settings';
import AddFriend from './AddFriend';

const Dashboard: React.FC = () => {
  const { currentUser, updateLinkStatus, removeFriend } = useAuth();
  const [activeTab, setActiveTab] = useState<'links' | 'friends'>('links');
  const [showShareLink, setShowShareLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);

  const sortedLinks = useMemo(() => {
    if (!currentUser) return [];
    
    const allLinks = [
      ...(currentUser.sharedLinks || []).map(link => ({ ...link, type: 'shared' as const })),
      ...(currentUser.receivedLinks || []).map(link => ({ ...link, type: 'received' as const }))
    ];

    return allLinks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [currentUser]);

  if (!currentUser) {
    return null;
  }

  if (showShareLink) {
    return <ShareLink onBack={() => setShowShareLink(false)} />;
  }

  if (showSettings) {
    return <SettingsComponent onBack={() => setShowSettings(false)} />;
  }

  if (showAddFriend) {
    return <AddFriend onBack={() => setShowAddFriend(false)} />;
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };


  const handleLinkClick = async (link: string, status: 'unseen' | 'opened') => {
    if (status === 'unseen') {
      await updateLinkStatus(link, 'opened');
    }
    window.open(link, '_blank');
  };

  const handleRemoveFriend = async (friendUsername: string) => {
    try {
      await removeFriend(friendUsername);
    } catch (error) {
      console.error('Failed to remove friend:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-l-gray-400">
            <img 
              src={currentUser.photoURL || '/default-avatar.png'} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-base font-semibold">Welcome, {currentUser.displayName?.split(' ')[0]}</h1>
            <p className="text-gray-500">@{currentUser.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowShareLink(true)}
            className="bg-[#6C5CE7] text-white font-medium px-4 py-2 rounded-full flex items-center gap-2"
          >
            <Share className="w-4 h-4" />
            Share a link
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 p-4">
        <button
          onClick={() => setActiveTab('links')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            activeTab === 'links' 
              ? 'bg-gray-900 text-white font-medium' 
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          <Link2 className="w-4 h-4" />
          Links Dashboard
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            activeTab === 'friends' 
                ? 'bg-gray-900 text-white font-medium' 
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Your Friends
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pt-0 overflow-auto">
        {activeTab === 'links' && (
          <div className="space-y-3">
            {sortedLinks.map((link, index) => (
              <div key={`${link.type}-${index}`} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Share2 className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <a 
                    href={link.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex font-bold text-sm hover:underline mb-1"
                    onClick={() => link.type === 'received' && handleLinkClick(link.link, link.status)}
                  >
                    {link.link}
                  </a>
                  <p className="text-xs text-gray-500">
                    {link.type === 'shared' 
                      ? `You sent to ${link.recipients.join(', ')}` 
                      : `Shared by ${link.sender}`}
                  </p>
                </div>
                <div className="flex flex-col justify-between items-end gap-2">
                  {link.type === 'shared' && (
                    link.status === 'unseen' 
                      ? <EyeOff className="w-4 h-4 text-gray-400" />
                      : <Eye className="w-4 h-4 text-green-500" />
                  )}
                  <span className="text-xs text-gray-400">{getTimeAgo(link.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'friends' && (
          <div className="space-y-4">
            <button
              onClick={() => setShowAddFriend(true)}
              className="w-full bg-[#6C5CE7] text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add New Friend
            </button>
            <div className="space-y-2">
              {currentUser.friends && currentUser.friends.length > 0 ? (
                currentUser.friends.map((friend) => (
                  <div key={friend} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>{friend}</span>
                    <button
                      onClick={() => handleRemoveFriend(friend)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500">You haven't added any friends yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
