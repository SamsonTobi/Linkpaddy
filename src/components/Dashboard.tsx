import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link2, Users, Share2, Eye, EyeOff, Settings, Share, UserMinus, UserPlus, X } from 'lucide-react';
import ShareLink from './ShareLink';
import SettingsComponent from './Settings';
import AddFriend from './AddFriend';

const seenLinkIcon = <svg xmlns="http://www.w3.org/2000/svg"  className="w-5 h-5" width="28" height="28" viewBox="0 0 28 28" fill="none">
<path d="M11.667 14C11.667 14.6188 11.9128 15.2123 12.3504 15.6499C12.788 16.0875 13.3815 16.3333 14.0003 16.3333C14.6192 16.3333 15.2127 16.0875 15.6502 15.6499C16.0878 15.2123 16.3337 14.6188 16.3337 14C16.3337 13.3812 16.0878 12.7877 15.6502 12.3501C15.2127 11.9125 14.6192 11.6667 14.0003 11.6667C13.3815 11.6667 12.788 11.9125 12.3504 12.3501C11.9128 12.7877 11.667 13.3812 11.667 14Z" stroke="#45A134" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12.9523 20.9498C9.21511 20.5905 6.06433 18.2739 3.5 14C6.3 9.33333 9.8 7 14 7C18.2 7 21.7 9.33333 24.5 14C24.2545 14.4091 23.9966 14.8107 23.7265 15.204M17.5 22.1667L19.8333 24.5L24.5 19.8333" stroke="#45A134" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>;

const Dashboard: React.FC = () => {
  const { currentUser, updateLinkStatus, removeFriend } = useAuth();
  const [activeTab, setActiveTab] = useState<'links' | 'friends'>('links');
  const [showShareLink, setShowShareLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<string | null>(null);

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

  const handleLinkClick = async (link: any) => {
    if (link.type === 'received' && link.status === 'unseen') {
      try {
        await updateLinkStatus(link.id, 'opened');
        
        chrome.runtime.sendMessage({ 
          type: 'UPDATE_LINK_STATUS',
          linkId: link.id,
          status: 'opened',
          senderUsername: link.sender
        });
  
        window.open(link.link, '_blank');
      } catch (error) {
        console.error('Error updating link status:', error);
        window.open(link.link, '_blank');
      }
    } else {
      window.open(link.link, '_blank');
    }
  };

  const handleRemoveFriend = (friendUsername: string) => {
    setFriendToRemove(friendUsername);
  };

  const confirmRemoveFriend = async () => {
    if (friendToRemove) {
      try {
        await removeFriend(friendToRemove);
        setFriendToRemove(null);
      } catch (error) {
        console.error('Failed to remove friend:', error);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
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

      <div className="flex-1 p-4 pt-0 overflow-auto">
        {activeTab === 'links' && (
          <div className="space-y-3">
            {sortedLinks.map((link, index) => (
              <div key={`${link.type}-${index}`} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Share2 className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <a 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleLinkClick(link);
                    }}
                    rel="noopener noreferrer" 
                    className="flex font-bold text-sm hover:underline mb-1"
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
                      : seenLinkIcon
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

      {friendToRemove && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h2 className="text-lg font-semibold mb-4">Remove Friend</h2>
            <p className="mb-6">Are you sure you want to remove {friendToRemove} from your friends list?</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setFriendToRemove(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveFriend}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

