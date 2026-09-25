import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeft,
  LinkSimple,
  TextT,
  ClipboardText,
  Globe,
  PaperPlaneTilt,
  MagnifyingGlass,
  UserPlus,
  Plus,
  Info,
  Check,
} from "@phosphor-icons/react";
import CustomButton from "./ui/CustomButton";
import AddFriend from "./AddFriend";

interface ShareLinkProps {
  onBack: () => void;
  initialLink?: string;
  initialText?: string;
  initialContentType?: "link" | "text";
  skipToFriends?: boolean;
  initialSelectedUsernames?: string[];
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
  initialText = "",
  initialContentType,
  skipToFriends = false,
  initialSelectedUsernames,
}) => {
  const { currentUser, shareLink, shareText } = useAuth();
  const [contentType, setContentType] = useState<"link" | "text">(
    initialContentType ?? (initialText ? "text" : "link"),
  );
  const [text, setText] = useState(initialText);
  const [link, setLink] = useState(initialLink);
  const [showFriendsList, setShowFriendsList] = useState(
    skipToFriends && (!!initialLink || !!initialText),
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

    const recent = new Map((currentUser?.recentShareRecipientUsernames || []).map((username, index) => [username, index]));
    return Array.from(friendMap.values()).sort((a, b) => (recent.get(a.username) ?? Number.MAX_SAFE_INTEGER) - (recent.get(b.username) ?? Number.MAX_SAFE_INTEGER));
  }, [currentUser?.friends, currentUser?.recentShareRecipientUsernames]);

  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) return uniqueFriends;
    const term = searchTerm.trim().toLowerCase();
    return uniqueFriends.filter(
      (f) =>
        f.username.includes(term) ||
        f.displayName.toLowerCase().includes(term),
    );
  }, [uniqueFriends, searchTerm]);

  const shareLabel = (() => {
    if (isSharing) return "Sharing...";
    if (selectedFriendKeys.length === 1) {
      const friend = uniqueFriends.find((f) => f.key === selectedFriendKeys[0]);
      const firstName = friend?.displayName?.trim().split(/\s+/)[0] || friend?.username;
      return firstName ? `Share to ${firstName}` : "Share";
    }
    if (selectedFriendKeys.length > 1) return `Share to all ${selectedFriendKeys.length}`;
    return "Share";
  })();

  const hasShareableContent =
    contentType === "text" ? text.trim().length > 0 : link.trim().length > 0;
  const canShare =
    hasShareableContent && selectedFriendKeys.length > 0 && !isSharing;
  const shareDisabledReason = isSharing
    ? "Sharing..."
    : !hasShareableContent
      ? contentType === "text"
        ? "Write something to share first"
        : "Paste a link to share first"
      : "Select at least one friend";

  useEffect(() => {
    setSelectedFriendKeys((prevKeys) => {
      const validKeys = new Set(uniqueFriends.map((friend) => friend.key));
      return prevKeys.filter((key) => validKeys.has(key));
    });
  }, [uniqueFriends]);

  // Pre-check friends handed in by the caller (e.g. quick-share from recents).
  useEffect(() => {
    if (!initialSelectedUsernames || initialSelectedUsernames.length === 0) return;
    const wanted = new Set(
      initialSelectedUsernames.map((name) => String(name || "").trim().replace(/^@/, "").toLowerCase()),
    );
    setSelectedFriendKeys(uniqueFriends.filter((friend) => wanted.has(friend.username)).map((friend) => friend.key));
    // Run once on mount; the sheet unmounts on close so this never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    if (!initialLink && !initialText) {
      checkClipboard();
      getCurrentTab();
    }
  }, [initialLink, initialText]);

  // Auto-open the friend list when a link is entered
  useEffect(() => {
    if (link || (contentType === "text" && text.trim())) {
      setShowFriendsList(true);
    }
  }, [link, text, contentType]);

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
    if (contentType === "link" && !link.trim()) {
      setError("Please enter a link");
      return;
    }
    if (contentType === "text" && !text.trim()) {
      setError("Write something to share");
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
      if (contentType === "text") await shareText(text.trim(), selectedRecipients);
      else await shareLink(link, selectedRecipients);
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
          <h2 className="flex-1 text-xl font-semibold outfit-semibold">Share something</h2>
        <CustomButton
          type="submit"
          form="share-form"
          disabled={!canShare}
          title={canShare ? undefined : shareDisabledReason}
          variant="primary"
          size="md"
          className="rounded-full px-5 outfit-semibold"
          showArrow={false}
          trailingIcon={<PaperPlaneTilt className="w-4 h-4" />}
        >
          {shareLabel}
        </CustomButton>
      </div>

      <div className="px-4 pt-4 pb-6 flex-1 overflow-auto">
        <form id="share-form" onSubmit={handleShare} className="space-y-4">
          <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
            <button type="button" onClick={() => setContentType("link")} className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm ${contentType === "link" ? "bg-white shadow-sm font-medium" : "text-gray-500"}`}><LinkSimple className="w-4 h-4" /> Link</button>
            <button type="button" onClick={() => setContentType("text")} className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm ${contentType === "text" ? "bg-white shadow-sm font-medium" : "text-gray-500"}`}><TextT className="w-4 h-4" /> Text</button>
          </div>

          {contentType === "text" ? (
            <div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share a thought with your circle..." maxLength={1000} className="w-full min-h-32 resize-none border border-gray-200 rounded-xl p-4 outfit-normal focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]" disabled={isSharing} />
              <p className="mt-1 text-right text-xs text-gray-400">{text.length}/1000</p>
            </div>
          ) : <div>
            <div className="flex items-center px-4 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#6C5CE7]">
            <LinkSimple className="w-5 h-5 mr-3 text-gray-400" />
            <input
              type="text"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Enter the link(s) you want to share"
              className="w-full bg-white py-4 outfit-normal focus:outline-none placeholder:text-gray-400"
              disabled={isSharing}
              required
            />
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400 outfit-normal"><Info className="h-3.5 w-3.5 shrink-0" /> Tip: share multiple links at once — separate them with commas.</p>
          </div>}

          {contentType === "link" && !link && clipboardLink && !hasUsedClipboard && (
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

          {contentType === "link" && !link && currentTabLink && (
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
                  <div className="grid max-h-64 grid-cols-3 gap-3 overflow-y-auto p-1">
                    {filteredFriends.map((friend) => {
                      const selected = selectedFriendKeys.includes(friend.key);
                      return (
                        <label
                          key={friend.key}
                          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-transform duration-150 hover:scale-[1.03] active:scale-95 ${selected ? "border-[#6C5CE7] bg-indigo-50/60 ring-1 ring-[#6C5CE7]" : "border-gray-200"}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleFriend(friend.key)}
                            disabled={isSharing}
                            className="sr-only"
                          />
                          <span className="relative">
                            <img
                              src={friend.photoURL || "/default-avatar.png"}
                              alt={`${friend.username}'s avatar`}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                            {selected && (
                              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#6C5CE7] text-white">
                                <Check className="h-3 w-3" weight="bold" />
                              </span>
                            )}
                          </span>
                          <span className="w-full">
                            <span className="flex items-center justify-center gap-1">
                              <span className="truncate font-medium text-xs outfit-medium">
                                {friend.displayName}
                              </span>
                              {friend.status === "request_sent" && (
                                <span className="shrink-0 text-[10px] font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded-full leading-none">
                                  Pending
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-gray-400 text-[11px] outfit-normal">
                              @{friend.username}
                            </span>
                          </span>
                        </label>
                      );
                    })}
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
