import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Users } from "lucide-react";
import OnboardingAddFriends from "./OnboardingAddFriends";

const Onboarding: React.FC = () => {
  const { currentUser, completeOnboarding, updateUsername } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(
    currentUser?.username || "",
  );
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  useEffect(() => {
    setUsernameDraft(currentUser?.username || "");
  }, [currentUser?.username]);

  const handleComplete = () => {
    completeOnboarding();
  };

  const handleSaveUsername = async () => {
    const normalized = usernameDraft.trim().replace(/^@/, "").toLowerCase();
    if (!normalized) {
      setUsernameError("Username is required");
      return;
    }

    try {
      setIsSavingUsername(true);
      setUsernameError(null);
      await updateUsername(normalized);
      setIsEditingUsername(false);
    } catch (error) {
      setUsernameError(
        error instanceof Error ? error.message : "Failed to update username",
      );
    } finally {
      setIsSavingUsername(false);
    }
  };

  if (showAddFriends) {
    return <OnboardingAddFriends onComplete={handleComplete} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6 text-center">
      {/* Success Message */}
      <div className="mb-2 flex flex-col items-center justify-center gap-2">
        <div className="w-7 h-7 bg-[#DBFFCC] rounded-full flex items-center justify-center">
          <svg
            className="w-3 h-3 text-[#45A134]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <span className="text-[#45A134] text-sm font-medium outfit-medium">
          Sign In Successful 🎉
        </span>
      </div>

      {/* Username Display */}
      <div className="bg-gray-100 rounded-lg py-2 px-4 mb-8">
        {!isEditingUsername ? (
          <div className="text-left">
            <span className="text-gray-600 outfit-normal">
              Your Username is{" "}
            </span>
            <span className="font-semibold outfit-semibold">
              @{currentUser?.username}
            </span>
            <button
              onClick={() => {
                setIsEditingUsername(true);
                setUsernameError(null);
              }}
              className="ml-2 text-xs text-[#6C5CE7] outfit-medium hover:underline"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center rounded-md border border-gray-300 bg-white px-2 py-1">
              <span className="text-gray-500 text-sm">@</span>
              <input
                type="text"
                value={usernameDraft}
                onChange={(e) => {
                  setUsernameDraft(e.target.value);
                  if (usernameError) setUsernameError(null);
                }}
                className="ml-1 w-full text-sm outfit-normal focus:outline-none"
                maxLength={20}
                disabled={isSavingUsername}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveUsername}
                disabled={isSavingUsername}
                className="text-xs bg-[#6C5CE7] text-white px-3 py-1 rounded-full outfit-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingUsername ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setIsEditingUsername(false);
                  setUsernameDraft(currentUser?.username || "");
                  setUsernameError(null);
                }}
                disabled={isSavingUsername}
                className="text-xs border border-gray-300 text-gray-700 px-3 py-1 rounded-full outfit-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
            {usernameError && (
              <p className="text-xs text-red-500 outfit-normal">
                {usernameError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-xl font-bold outfit-bold mb-2.5 font-test">
          Ready to share your discoveries?
        </h1>
        <p className="text-gray-600 mb-6 outfit-normal">
          {currentUser?.displayName?.split(" ")[0]}, you'll need friends to make
          the most of this extension
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
