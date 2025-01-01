import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeft,
  Clipboard,
  ExternalLink,
  Globe,
  Link2,
  Share,
} from "lucide-react";

interface ShareLinkProps {
  onBack: () => void;
  initialLink?: string;
}

const ShareLink: React.FC<ShareLinkProps> = ({ onBack, initialLink = "" }) => {
  const { currentUser, shareLink } = useAuth();
  const [link, setLink] = useState(initialLink);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clipboardLink, setClipboardLink] = useState<string | null>(null);
  const [currentTabLink, setCurrentTabLink] = useState<string | null>(null);
  const [hasUsedClipboard, setHasUsedClipboard] = useState(false);

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText.startsWith("http://") || clipText.startsWith("https://")) {
          setClipboardLink(clipText);
        }
      } catch (err) {
        console.error("Clipboard access error:", err);
      }
    };

    const getCurrentTab = async () => {
      try {
        const queryOptions = { active: true, lastFocusedWindow: true };
        const [tab] = await chrome.tabs.query(queryOptions);
        if (
          tab?.url &&
          (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
        ) {
          setCurrentTabLink(tab.url);
        }
      } catch (err) {
        console.error("Tab access error:", err);
      }
    };

    if (!initialLink) {
      checkClipboard();
      getCurrentTab();
    }
  }, [initialLink]);

  const handleClipboardPaste = () => {
    if (clipboardLink) {
      setLink(clipboardLink);
      setHasUsedClipboard(true);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!link) {
      setError("Please enter a link");
      return;
    }
    if (selectedFriends.length === 0) {
      setError("Please select at least one friend");
      return;
    }
    try {
      await shareLink(link, selectedFriends);
      onBack();
    } catch (error) {
      setError("Failed to share link");
    }
  };

  const toggleFriend = (friendUsername: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendUsername)
        ? prev.filter((f) => f !== friendUsername)
        : [...prev, friendUsername]
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 p-4 border-b">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold outfit-semibold">Share link</h2>
      </div>

      <div className="p-4 flex-1">
        <form onSubmit={handleShare} className="space-y-4">
          <div className="flex items-center px-4 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#6C5CE7]">
            <Link2 className="w-5 h-5 mr-3 text-gray-400" />
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Enter the link you want to share"
              className="w-full bg-white py-4 outfit-normal focus:outline-none placeholder:text-gray-400"
              required
            />
          </div>

          {!link && clipboardLink && !hasUsedClipboard && (
            <button
              type="button"
              onClick={handleClipboardPaste}
              className="w-full font-medium bg-gray-100 text-gray-700 py-3 px-4 rounded-lg outfit-medium hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <Clipboard className="w-4 h-4" />
              Paste from clipboard
            </button>
          )}

          {!link && currentTabLink && (
            <button
              type="button"
              onClick={() => setLink(currentTabLink)}
              className="w-full font-medium bg-gray-100 text-gray-700 py-3 px-4 rounded-lg outfit-medium hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <Globe className="w-4 h-4" />
              Share this current tab
            </button>
          )}

          {link && !showFriendsList ? (
            <button
              type="button"
              onClick={() => setShowFriendsList(true)}
              className="w-full font-semibold outfit-semibold bg-[#6C5CE7] text-white py-3 px-4 rounded-full gap-2 hover:bg-opacity-90 flex items-center justify-center"
            >
              <ExternalLink className="w-4 h-4" />
              Send to
            </button>
          ) : null}

          {showFriendsList && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm outfit-semibold">
                Select friends:
              </h3>
              {currentUser?.friends && currentUser.friends.length > 0 ? (
                <>
                  <div className="space-y-2 mb-4">
                    {currentUser.friends.map((friend) => (
                      <label
                        key={friend.username}
                        className="flex items-center cursor-pointer gap-2 p-3 border rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFriends.includes(friend.username)}
                          onChange={() => toggleFriend(friend.username)}
                          className="w-4 h-4 accent-[#6C5CE7] outfit-normal text-sm"
                        />
                        <div className="flex ml-2  items-center gap-2">
                          <img
                            src={friend.photoURL || "/default-avatar.png"}
                            alt={`${friend.username}'s avatar`}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-medium text-sm outfit-medium">
                              {friend.displayName}
                            </p>
                            <p className="outfit-normal text-gray-400 -mt-1">
                              @{friend.username}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="w-full bg-[#6C5CE7] text-white py-3 px-4 rounded-full hover:bg-opacity-90 gap-2 mt-3 outfit-semibold flex items-center justify-center"
                    >
                      <Share className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 outfit-normal">
                  You haven't added any friends yet.
                </p>
              )}
            </div>
          )}
        </form>
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    </div>
  );
};

export default ShareLink;
