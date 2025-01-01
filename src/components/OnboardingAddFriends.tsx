import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Search, UserPlus, Check, CornerDownLeft, Mail } from "lucide-react";
import friendIllus from "../assets/network.png"; // Adjust the path as necessary

interface OnboardingAddFriendsProps {
  onComplete: () => void;
}

interface SearchResult {
  username: string;
  email: string;
}

const OnboardingAddFriends: React.FC<OnboardingAddFriendsProps> = ({
  onComplete,
}) => {
  const { searchUser, addFriend, currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [addedFriends, setAddedFriends] = useState<string[]>([]);
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [showSearchPrompt, setShowSearchPrompt] = useState(false);

  useEffect(() => {
    if (searchTerm) {
      setShowSearchPrompt(true);
    } else {
      setShowSearchPrompt(false);
    }
  }, [searchTerm]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSearchPrompt(false);

    if (!searchTerm) return;

    try {
      const user = await searchUser(searchTerm);
      if (user) {
        setSearchResult({
          username: user.username || "",
          email: user.email || "",
        });
      } else {
        // User not found, show invite card
        setSearchResult({
          username: "",
          email: searchTerm,
        });
      }
    } catch (error) {
      console.error("Error searching for user:", error);
    }
  };

  const handleAddFriend = async () => {
    if (!searchResult) return;

    try {
      if (searchResult.username) {
        await addFriend(searchResult.username);
        setAddedFriends((prev) => [...prev, searchResult.username]);
      } else {
        // Handle invitation
        setInvitedEmails((prev) => [...prev, searchResult.email]);
      }

      // Clear search
      setSearchTerm("");
      setSearchResult(null);
    } catch (error) {
      console.error("Failed to add friend:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchResult(null);
  };

  const totalCount = addedFriends.length + invitedEmails.length;

  return (
    <div className="flex flex-col items-center min-h-screen bg-white p-6">
      <div className="h-5 mt-7">
        <img
          src={friendIllus}
          alt="Illustration of a group of friends"
          className="h-full"
        />
      </div>
      <p className="text-xs outfit-normal text-[#6C5CE7] my-2">
        {currentUser?.displayName?.split(" ")[0]}, build your link sharing
        network
      </p>
      <h1 className="text-xl font-semibold outfit-semibold mb-6">
        Find your friends or invite new ones
      </h1>

      <div className="w-full ">
        <form onSubmit={handleSearch} className="w-full">
          <div className="flex items-center px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#6C5CE7]">
            <Search className="w-5 h-5 mr-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              placeholder="Enter email/username to find friends or send invites"
              className="w-full py-4 outfit-normal focus:outline-none placeholder:text-gray-400"
            />
          </div>
        </form>

        {showSearchPrompt && (
          <div className="flex items-center mt-2">
            <CornerDownLeft className="w-3 h-3 mr-3 text-gray-500" />
            <p className="text-xs outfit-normal text-gray-500">
              Press enter to search
            </p>
          </div>
        )}
      </div>

      {searchResult && (
        <div className="mt-4 p-4 w-full bg-gray-50 rounded-lg">
          {searchResult.username ? (
            // Existing user card
            <>
              <p className="text-xs text-[#45A134] mb-2 outfit-normal">✓ Found</p>
              <p className="font-medium text-base">{searchResult.email}</p>
              <p className="text-sm">@{searchResult.username}</p>
              <button
                onClick={handleAddFriend}
                className="mt-4 w-full bg-[#6C5CE7] text-white font-medium outfit-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Friend
              </button>
            </>
          ) : (
            // Invite card
            <>
              <p className="text-xs text-gray-500 mb-1 outfit-normal">
                Looks like they haven't joined yet
              </p>
              <p className="font-medium outfit-medium text-base">{searchResult.email}</p>
              <button
                onClick={handleAddFriend}
                className="mt-4 w-full bg-gray-800 text-white font-medium outfit-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Send an Invite Mail
              </button>
            </>
          )}
        </div>
      )}

      {totalCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex items-center justify-between">
          <p className="text-gray-900 text-sm font-medium outfit-medium">
            {totalCount} {totalCount === 1 ? "friend" : "friends"}{" "}
            {addedFriends.length > 0 && invitedEmails.length > 0
              ? "added/invited"
              : addedFriends.length > 0
              ? "added"
              : "invited"}
          </p>
          <button
            onClick={onComplete}
            className="bg-[#6C5CE7] text-white font-medium outfit-medium px-6 py-2 rounded-full flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingAddFriends;
