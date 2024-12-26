import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link2, Users, Share2, Eye, Settings, Share } from 'lucide-react';
import ShareLink from './ShareLink';
import SettingsComponent from './Settings';

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'links' | 'friends'>('links');
  const [showShareLink, setShowShareLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!currentUser) {
    return null;
  }

  if (showShareLink) {
    return <ShareLink onBack={() => setShowShareLink(false)} />;
  }

  if (showSettings) {
    return <SettingsComponent onBack={() => setShowSettings(false)} />;
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden">
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
            <Settings className="w-6 h-6" />
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
          Friends
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {activeTab === 'links' && (
          <div className="space-y-3">
            {currentUser.sharedLinks?.map((link, index) => (
              <div key={`shared-${index}`} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Share2 className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <a href={link.link} target="_blank" rel="noopener noreferrer" className="font-bold text-sm hover:underline mb-1">
                    {link.link}
                  </a>
                  <p className="text-xs text-gray-500">
                    You sent to {link.recipients.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">{getTimeAgo(link.timestamp)}</span>
                  <button className="text-green-500">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            {currentUser.receivedLinks?.map((link, index) => (
              <div key={`received-${index}`} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Share2 className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <a href={link.link} target="_blank" rel="noopener noreferrer" className="font-bold text-sm hover:underline mb-1">
                    {link.link}
                  </a>
                  <p className="text-xs text-gray-500">
                    Shared by {link.sender}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">{getTimeAgo(link.timestamp)}</span>
                  <button className="text-green-500">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'friends' && (
          <div className="p-4 text-center text-gray-500">
            Friends tab content coming soon...
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

