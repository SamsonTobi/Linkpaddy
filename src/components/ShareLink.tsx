import React, { useState, useEffect, useMemo } from "react";
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
  skipToFriends?: boolean;
}

const ShareLink: React.FC<ShareLinkProps> = ({
  onBack,
  initialLink = "",
  skipToFriends = false,
}) => {
  const { currentUser, shareLink } = useAuth();
  const [link, setLink] = useState(initialLink);
  const [showFriendsList, setShowFriendsList] = useState(
    skipToFriends && !!initialLink,
  );
  const [selectedFriendKeys, setSelectedFriendKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clipboardLink, setClipboardLink] = useState<string | null>(null);
  const [currentTabLink, setCurrentTabLink] = useState<string | null>(null);
  const [hasUsedClipboard, setHasUsedClipboard] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const uniqueFriends = useMemo(() => {
    const friendMap = new Map<
      string,
      { key: string; username: string; displayName: string; photoURL: string }
    >();

    (currentUser?.friends || []).forEach((friend) => {
      const username =
        typeof friend?.username === "string"
          ? friend.username.trim().replace(/^@/, "").toLowerCase()
          : "";
      if (!username) return;

      const uid =
        typeof friend?.uid === "string" && friend.uid.trim()
          ? friend.uid.trim()
          : "";
      const key = uid || username;

      if (!friendMap.has(key)) {
        friendMap.set(key, {
          key,
          username,
          displayName:
            typeof friend?.displayName === "string" ? friend.displayName : "",
          photoURL: typeof friend?.photoURL === "string" ? friend.photoURL : "",
        });
      }
    });

    return Array.from(friendMap.values());
  }, [currentUser?.friends]);

  useEffect(() => {
    setSelectedFriendKeys((prevKeys) => {
      const validKeys = new Set(uniqueFriends.map((friend) => friend.key));
      return prevKeys.filter((key) => validKeys.has(key));
    });
  }, [uniqueFriends]);

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
    if (isSharing) return;

    setError(null);
    if (!link) {
      setError("Please enter a link");
      return;
    }

    const selectedRecipients = uniqueFriends
      .filter((friend) => selectedFriendKeys.includes(friend.key))
      .map((friend) => friend.username);

    if (selectedRecipients.length === 0) {
      setError("Please select at least one friend");
      return;
    }

    try {
      setIsSharing(true);
      await shareLink(link, selectedRecipients);
      onBack();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to share link");
    } finally {
      setIsSharing(false);
    }
  };

  const toggleFriend = (friendKey: string) => {
    setSelectedFriendKeys((prev) =>
      prev.includes(friendKey)
        ? prev.filter((key) => key !== friendKey)
        : [...prev, friendKey],
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 p-4 border-b">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full"
          disabled={isSharing}
        >
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
              disabled={isSharing}
              required
            />
          </div>

          {!link && clipboardLink && !hasUsedClipboard && (
            <button
              type="button"
              onClick={handleClipboardPaste}
              disabled={isSharing}
              className="w-full font-medium bg-gray-100 text-gray-700 py-3 px-4 rounded-lg outfit-medium hover:bg-gray-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Clipboard className="w-4 h-4" />
              Paste from clipboard
            </button>
          )}

          {!link && currentTabLink && (
            <button
              type="button"
              onClick={() => setLink(currentTabLink)}
              disabled={isSharing}
              className="w-full font-medium bg-gray-100 text-gray-700 py-3 px-4 rounded-lg outfit-medium hover:bg-gray-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Globe className="w-4 h-4" />
              Share this current tab
            </button>
          )}

          {link && !showFriendsList ? (
            <button
              type="button"
              onClick={() => setShowFriendsList(true)}
              disabled={isSharing}
              className="w-full font-semibold outfit-semibold bg-[#6C5CE7] text-white py-3 px-4 rounded-full gap-2 hover:bg-opacity-90 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
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
              {uniqueFriends.length > 0 ? (
                <>
                  <div className="space-y-2 mb-4">
                    {uniqueFriends.map((friend) => (
                      <label
                        key={friend.key}
                        className="flex items-center cursor-pointer gap-2 p-3 border rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFriendKeys.includes(friend.key)}
                          onChange={() => toggleFriend(friend.key)}
                          disabled={isSharing}
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
                      disabled={isSharing}
                      className="w-full bg-[#6C5CE7] text-white py-3 px-4 rounded-full hover:bg-opacity-90 gap-2 mt-3 outfit-semibold flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Share className="w-4 h-4" />
                      {isSharing ? "Sharing..." : "Share"}
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
