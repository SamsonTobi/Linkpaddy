import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, LogOut } from 'lucide-react';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { currentUser, signOut } = useAuth();

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-4 p-4 border-b">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold">Settings</h2>
      </div>

      <div className="p-4 flex-1">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-full overflow-hidden">
            <img 
              src={currentUser?.photoURL || '/default-avatar.png'} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">{currentUser?.displayName}</h3>
            <p className="text-gray-500">@{currentUser?.username}</p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 text-red-500 hover:bg-red-50 rounded-lg"
        >
          <LogOut className="w-5 h-5" />
          Sign out
        </button>
      </div>
    </div>
  );
};

export default Settings;

