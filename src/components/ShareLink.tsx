import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeft,
  LinkSimple,
  ClipboardText,
  Globe,
  PaperPlaneTilt,
  MagnifyingGlass,
  UserPlus,
  Plus,
} from "@phosphor-icons/react";
import CustomButton from "./ui/CustomButton";
import AddFriend from "./AddFriend";

interface ShareLinkProps {
  onBack: () => void;
  initialLink?: string;
  skipToFriends?: boolean;
}

interface FriendEntry {
  key: string;
  username: string;
  displayName: string;
  photoURL: string;
  status?: string;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);

  const uniqueFriends = useMemo(() => {
    const friendMap = new Map<
      string,
      FriendEntry
    >();

    (currentUser?.friends || []).forEach((friend) => {
      if (friend?.status && friend.status !== "accepted" && friend.status !== "request_sent" && friend.status !== "auto") return;

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
          status: friend?.status,
        });
      }
    });

    return Array.from(friendMap.values());
  }, [currentUser?.friends]);

  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) return uniqueFriends;
    const term = searchTerm.trim().toLowerCase();
    return uniqueFriends.filter(
      (f) =>
        f.username.includes(term) ||
        f.displayName.toLowerCase().includes(term),
    );
  }, [uniqueFriends, searchTerm]);

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

  // Auto-open the friend list when a link is entered
  useEffect(() => {
    if (link) {
      setShowFriendsList(true);
    }
  }, [link]);

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

    const selectedRecipients = filteredFriends
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

  if (showAddFriend) {
    return <AddFriend onBack={() => setShowAddFriend(false)} />;
  }

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

      <div className="px-4 pt-4 pb-6 flex-1 overflow-auto">
        <form onSubmit={handleShare} className="space-y-4">
          <div className="flex items-center px-4 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#6C5CE7]">
            <LinkSimple className="w-5 h-5 mr-3 text-gray-400" />
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
            <CustomButton
              type="button"
              onClick={handleClipboardPaste}
              disabled={isSharing}
              variant="neutral"
              fullWidth
              showArrow={false}
              trailingIcon={<ClipboardText className="w-5 h-5" />}
            >
              Paste from clipboard
            </CustomButton>
          )}

          {!link && currentTabLink && (
            <CustomButton
              type="button"
              onClick={() => setLink(currentTabLink)}
              disabled={isSharing}
              variant="neutral"
              fullWidth
              showArrow={false}
              trailingIcon={<Globe className="w-5 h-5" />}
            >
              Share this current tab
            </CustomButton>
          )}

          {showFriendsList && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm outfit-semibold">
                  {uniqueFriends.length > 0
                    ? "Select friends:"
                    : "No friends yet"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddFriend(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6C5CE7] bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {uniqueFriends.length > 0 && (
                <div className="flex items-center gap-2 px-3 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#6C5CE7]">
                  <MagnifyingGlass className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search friends..."
                    className="w-full py-2.5 text-sm bg-white outfit-normal focus:outline-none placeholder:text-gray-400"
                    disabled={isSharing}
                  />
                </div>
              )}

              {filteredFriends.length > 0 ? (
                <>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {filteredFriends.map((friend) => (
                      <label
                        key={friend.key}
                        className="flex items-center cursor-pointer gap-2 p-3 border rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFriendKeys.includes(friend.key)}
                          onChange={() => toggleFriend(friend.key)}
                          disabled={isSharing}
                          className="w-4 h-4 accent-[#6C5CE7] outfit-normal text-sm shrink-0"
                        />
                        <div className="flex ml-2 items-center gap-2 min-w-0">
                          <img
                            src={friend.photoURL || "/default-avatar.png"}
                            alt={`${friend.username}'s avatar`}
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm outfit-medium truncate">
                                {friend.displayName}
                              </p>
                              {friend.status === "request_sent" && (
                                <span className="shrink-0 text-[10px] font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded-full leading-none">
                                  Pending
                                </span>
                              )}
                            </div>
                            <p className="outfit-normal text-gray-400 text-sm -mt-0.5 truncate">
                              @{friend.username}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div>
                    <CustomButton
                      type="submit"
                      disabled={isSharing}
                      variant="primary"
                      fullWidth
                      className="mt-2 outfit-semibold"
                      showArrow={false}
                      trailingIcon={<PaperPlaneTilt className="w-5 h-5" />}
                    >
                      {isSharing ? "Sharing..." : "Share"}
                    </CustomButton>
                  </div>
                </>
              ) : uniqueFriends.length > 0 ? (
                <p className="text-gray-400 text-sm outfit-normal text-center py-4">
                  No friends match "{searchTerm}"
                </p>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 outfit-normal text-sm">
                    You haven't added any friends yet.
                  </p>
                  <CustomButton
                    type="button"
                    onClick={() => setShowAddFriend(true)}
                    variant="outlinePrimary"
                    size="sm"
                    className="mt-3"
                    showArrow={false}
                    trailingIcon={<Plus className="w-4 h-4" />}
                  >
                    Add a friend
                  </CustomButton>
                </div>
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
