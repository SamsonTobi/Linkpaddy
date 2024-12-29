import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users } from 'lucide-react';
import OnboardingAddFriends from './OnboardingAddFriends';

const Onboarding: React.FC = () => {
  const { currentUser, completeOnboarding } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);

  const handleComplete = () => {
    completeOnboarding();
  };

  if (showAddFriends) {
    return <OnboardingAddFriends onComplete={handleComplete} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6 text-center">
      {/* Success Message */}
      <div className="mb-2 flex flex-col items-center justify-center gap-2">
        <div className="w-7 h-7 bg-[#DBFFCC] rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-[#45A134]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-[#45A134] text-sm font-medium outfit-medium">Sign In Successful 🎉</span>
      </div>

      {/* Username Display */}
      <div className="bg-gray-100 rounded-lg py-2 px-4 mb-8">
        <div className="text-left">
          <span className="text-gray-600 outfit-normal">Your Username is </span>
          <span className="font-semibold outfit-semibold">@{currentUser?.username}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-xl font-bold outfit-bold mb-2.5 font-test">Ready to share your discoveries?</h1>
        <p className="text-gray-600 mb-6 outfit-normal">
        {currentUser?.displayName?.split(' ')[0]}, you'll need friends to make the most of this extension
        </p>

        {/* Add Friends Button */}
        <button
          onClick={() => setShowAddFriends(true)}
          className="w-[85%] flex items-center justify-center gap-2 bg-[#6C5CE7] text-white text-xs py-3 px-6 rounded-full font-medium outfit-medium hover:bg-[#6051ce]"
        >
          <Users className="w-4 h-4" />
          Add Some Friends
        </button>
      </div>
    </div>
  );
};

export default Onboarding;