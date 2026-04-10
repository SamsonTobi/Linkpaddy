import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Link2,
  Users,
  Share2,
  Settings,
  Share,
  UserMinus,
  UserPlus,
  Unlink,
  UsersRound,
  Filter,
  ChevronDown,
} from "lucide-react";
import ShareLink from "./ShareLink";
import SettingsComponent from "./Settings";
import AddFriend from "./AddFriend";

interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

// Unseen icon - gray eye with slash (not seen yet)
const unseenLinkIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
  >
    <path
      d="M4.667 4.667L23.333 23.333M11.847 11.907C11.294 12.478 10.962 13.219 10.962 14.039C10.962 15.743 12.336 17.117 14.039 17.117C14.859 17.117 15.6 16.785 16.171 16.232M7.583 7.82C5.425 9.393 3.85 11.52 3.5 14C4.667 18.667 8.75 22.167 14 22.167C16.275 22.167 18.375 21.467 20.125 20.3M12.25 5.95C12.817 5.867 13.4 5.833 14 5.833C19.25 5.833 23.333 9.333 24.5 14C24.183 15.167 23.683 16.233 23.042 17.183"
      stroke="#9CA3AF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Seen icon - blue eye (viewed in list but not clicked)
const viewedLinkIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
  >
    <path
      d="M11.667 14C11.667 14.6188 11.9128 15.2123 12.3504 15.6499C12.788 16.0875 13.3815 16.3333 14.0003 16.3333C14.6192 16.3333 15.2127 16.0875 15.6502 15.6499C16.0878 15.2123 16.3337 14.6188 16.3337 14C16.3337 13.3812 16.0878 12.7877 15.6502 12.3501C15.2127 11.9125 14.6192 11.6667 14.0003 11.6667C13.3815 11.6667 12.788 11.9125 12.3504 12.3501C11.9128 12.7877 11.667 13.3812 11.667 14Z"
      stroke="#6C5CE7"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.5 14C6.3 9.33333 9.8 7 14 7C18.2 7 21.7 9.33333 24.5 14C21.7 18.6667 18.2 21 14 21C9.8 21 6.3 18.6667 3.5 14Z"
      stroke="#6C5CE7"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Opened icon - green eye with checkmark (clicked and opened)
const openedLinkIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
  >
    <path
      d="M11.667 14C11.667 14.6188 11.9128 15.2123 12.3504 15.6499C12.788 16.0875 13.3815 16.3333 14.0003 16.3333C14.6192 16.3333 15.2127 16.0875 15.6502 15.6499C16.0878 15.2123 16.3337 14.6188 16.3337 14C16.3337 13.3812 16.0878 12.7877 15.6502 12.3501C15.2127 11.9125 14.6192 11.6667 14.0003 11.6667C13.3815 11.6667 12.788 11.9125 12.3504 12.3501C11.9128 12.7877 11.667 13.3812 11.667 14Z"
      stroke="#45A134"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M12.9523 20.9498C9.21511 20.5905 6.06433 18.2739 3.5 14C6.3 9.33333 9.8 7 14 7C18.2 7 21.7 9.33333 24.5 14C24.2545 14.4091 23.9966 14.8107 23.7265 15.204M17.5 22.1667L19.8333 24.5L24.5 19.8333"
      stroke="#45A134"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

const Dashboard: React.FC = () => {
  const { currentUser, updateLinkStatus, removeFriend } = useAuth();
  const [activeTab, setActiveTab] = useState<"links" | "friends">("links");
  const [linkFilter, setLinkFilter] = useState<"all" | "sent" | "received">(
    "all",
  );
  const [showShareLink, setShowShareLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<string | null>(null);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreview>>(
    {},
  );

  const showLinkPreviews = currentUser?.settings?.showLinkPreviews ?? true;

  const sortedLinks = useMemo(() => {
    if (!currentUser) return [];
    const allLinks = [
      ...(currentUser.sharedLinks || []).map((link) => ({
        ...link,
        type: "shared" as const,
      })),
      ...(currentUser.receivedLinks || [])
        .filter((link: any) => link.kind !== "friend_added")
        .map((link) => ({
          ...link,
          type: "received" as const,
        })),
    ];

    return allLinks.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [currentUser]);

  // Filter links based on selected filter
  const filteredLinks = useMemo(() => {
    if (linkFilter === "all") return sortedLinks;
    if (linkFilter === "sent")
      return sortedLinks.filter((link) => link.type === "shared");
    return sortedLinks.filter((link) => link.type === "received");
  }, [sortedLinks, linkFilter]);

  // Separate unseen received links
  const unseenReceivedLinks = useMemo(() => {
    return filteredLinks.filter(
      (link) => link.type === "received" && link.status === "unseen",
    );
  }, [filteredLinks]);

  const otherLinks = useMemo(() => {
    return filteredLinks.filter(
      (link) => !(link.type === "received" && link.status === "unseen"),
    );
  }, [filteredLinks]);

  const uniqueFriends = useMemo(() => {
    if (!currentUser?.friends) return [];
    const friendMap = new Map<string, (typeof currentUser.friends)[number]>();
    currentUser.friends.forEach((friend) => {
      const username =
        typeof friend?.username === "string"
          ? friend.username.trim().replace(/^@/, "").toLowerCase()
          : "";
      const uid =
        typeof friend?.uid === "string" && friend.uid.trim()
          ? friend.uid.trim()
          : "";
      const identity = uid || username;
      if (!identity) return;
      if (!friendMap.has(identity)) {
        friendMap.set(identity, {
          ...friend,
          username: username || friend.username,
        });
      }
    });
    return Array.from(friendMap.values());
  }, [currentUser?.friends]);

  const hasNoLinks =
    (currentUser?.sharedLinks?.length || 0) +
      (currentUser?.receivedLinks?.length || 0) ===
    0;
  const hasNoFriends = uniqueFriends.length === 0;
  const showGettingStartedPrompt = hasNoLinks && hasNoFriends;

  // Fetch link previews
  useEffect(() => {
    if (!showLinkPreviews || sortedLinks.length === 0) return;

    const fetchPreview = async (url: string) => {
      try {
        // Use a CORS proxy or fetch metadata via background script
        const hostname = new URL(url).hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

        // Try to get Open Graph data via a metadata API
        const response = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(url)}`,
        );

        if (response.ok) {
          const data = await response.json();
          if (data.status === "success") {
            return {
              title: data.data.title,
              description: data.data.description,
              image: data.data.image?.url,
              favicon: data.data.logo?.url || favicon,
              siteName: hostname.replace("www.", ""),
            };
          }
        }

        // Fallback to just favicon
        return {
          favicon,
          siteName: hostname.replace("www.", ""),
        };
      } catch (error) {
        const hostname = new URL(url).hostname;
        return {
          favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
          siteName: hostname.replace("www.", ""),
        };
      }
    };

    const loadPreviews = async () => {
      const previews: Record<string, LinkPreview> = {};

      // Only load previews for links we haven't fetched yet
      const linksToFetch = sortedLinks
        .filter((link) => !linkPreviews[link.link])
        .slice(0, 10); // Limit to 10 at a time

      await Promise.all(
        linksToFetch.map(async (link) => {
          const preview = await fetchPreview(link.link);
          previews[link.link] = preview;
        }),
      );

      if (Object.keys(previews).length > 0) {
        setLinkPreviews((prev) => ({ ...prev, ...previews }));
      }
    };

    loadPreviews();
  }, [sortedLinks, showLinkPreviews]);

  // Mark unseen received links as "seen" when viewing the links tab
  useEffect(() => {
    if (activeTab !== "links" || !currentUser) return;

    const unseenLinks = sortedLinks.filter(
      (link) => link.type === "received" && link.status === "unseen",
    );

    unseenLinks.forEach(async (link) => {
      try {
        await updateLinkStatus(link.id, "seen");
        chrome.runtime.sendMessage({
          type: "UPDATE_LINK_STATUS",
          linkId: link.id,
          status: "seen",
          senderUsername: link.sender,
        });
      } catch (error) {
        console.error("Error marking link as seen:", error);
      }
    });
  }, [activeTab, sortedLinks]);

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

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? "min" : "mins"}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? "hr" : "hrs"}`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ${days === 1 ? "day" : "days"}`;
    const months = Math.floor(days / 30);
    if (months < 12)
      return `${months} ${months === 1 ? "month" : "months"} ago`;
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? "year" : "years"} ago`;
  };

  const formatAddedDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (error) {
      return "Date unavailable";
    }
  };

  const handleLinkClick = async (link: any) => {
    if (link.type === "received" && link.status !== "opened") {
      try {
        await updateLinkStatus(link.id, "opened");

        chrome.runtime.sendMessage({
          type: "UPDATE_LINK_STATUS",
          linkId: link.id,
          status: "opened",
          senderUsername: link.sender,
        });

        window.open(link.link, "_blank");
      } catch (error) {
        console.error("Error updating link status:", error);
        window.open(link.link, "_blank");
      }
    } else {
      window.open(link.link, "_blank");
    }
  };

  const handleRemoveFriend = (friendUsername: string) => {
    setFriendToRemove(friendUsername);
  };

  const confirmRemoveFriend = async () => {
    if (friendToRemove && !isRemovingFriend) {
      try {
        setIsRemovingFriend(true);
        await removeFriend(friendToRemove);
        setFriendToRemove(null);
      } catch (error) {
        console.error("Failed to remove friend:", error);
      } finally {
        setIsRemovingFriend(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-l-gray-400">
            <img
              src={currentUser.photoURL || "/default-avatar.png"}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-base font-semibold outfit-semibold leading-none">
              Welcome, {currentUser.displayName?.split(" ")[0]}
            </h1>
            <p className="text-gray-500 outfit-normal">
              @{currentUser.username}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShareLink(true)}
            className="bg-[#6C5CE7] text-white font-medium outfit-medium px-4 py-2 rounded-full flex items-center gap-2"
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

      <div className="flex gap-2 p-4 justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("links")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full outfit-normal ${
              activeTab === "links"
                ? "bg-gray-900 text-white font-medium outfit-medium"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Links Dashboard
          </button>
          <button
            onClick={() => setActiveTab("friends")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full outfit-normal ${
              activeTab === "friends"
                ? "bg-gray-900 text-white font-medium outfit-medium"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            <Users className="w-4 h-4" />
            Your Sharing Circle
          </button>
        </div>

        {/* Filter dropdown - only show when on links tab */}
        {activeTab === "links" && (
          <div className="relative inline-flex items-center gap-1 text-sm text-gray-600 w-fit whitespace-nowrap">
            <Filter className="w-4 h-4" />
            <select
              value={linkFilter}
              onChange={(e) =>
                setLinkFilter(e.target.value as "all" | "sent" | "received")
              }
              className="appearance-none bg-transparent pr-5 py-0 outfit-normal cursor-pointer focus:outline-none w-auto"
            >
              <option value="all">All</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-0 pointer-events-none" />
          </div>
        )}
      </div>

      <div className="flex-1 p-4 pt-0 overflow-auto">
        {activeTab === "links" && (
          <div className="space-y-3 h-full">
            {currentUser.sharedLinks &&
            currentUser.receivedLinks &&
            filteredLinks.length > 0 ? (
              <>
                {/* Unseen section - only show if there are unseen received links */}
                {unseenReceivedLinks.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <span className="w-2 h-2 rounded-full bg-[#6C5CE7]"></span>
                      <h3 className="text-sm font-semibold outfit-semibold text-gray-700">
                        Unseen
                      </h3>
                    </div>
                    {unseenReceivedLinks.map((link, index) => {
                      const preview = linkPreviews[link.link];
                      return (
                        <div
                          key={`unseen-${link.type}-${index}`}
                          className="bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-100 transition-colors relative"
                          onClick={() => handleLinkClick(link)}
                        >
                          {/* Blue dot indicator */}
                          <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-[#6C5CE7] z-10"></div>

                          {/* Link Preview Image */}
                          {showLinkPreviews && preview?.image && (
                            <div className="w-full h-32 bg-gray-200">
                              <img
                                src={preview.image}
                                alt={preview.title || "Link preview"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-4 p-4">
                            {/* Favicon or Icon */}
                            {showLinkPreviews && preview?.favicon ? (
                              <img
                                src={preview.favicon}
                                alt=""
                                className="w-5 h-5 rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <Share2 className="w-5 h-5 text-gray-400" />
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="block font-bold outfit-bold text-sm mb-1 truncate">
                                {showLinkPreviews && preview?.title
                                  ? preview.title
                                  : link.link}
                              </p>

                              {showLinkPreviews && preview?.description && (
                                <p className="text-xs text-gray-600 outfit-normal mb-1 line-clamp-2">
                                  {preview.description}
                                </p>
                              )}

                              <p className="text-xs text-gray-500 outfit-normal">
                                {showLinkPreviews && preview?.siteName && (
                                  <span className="text-gray-400">
                                    {preview.siteName} •{" "}
                                  </span>
                                )}
                                Shared by {link.sender}
                              </p>
                            </div>

                            <div className="flex flex-col justify-between items-end gap-2 flex-shrink-0">
                              <span className="text-xs bg-[#6C5CE7] text-white px-2 py-0.5 rounded-full">
                                New
                              </span>
                              <span className="text-xs text-gray-400 outfit-normal whitespace-nowrap">
                                {getTimeAgo(link.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Other links section */}
                {otherLinks.length > 0 && (
                  <>
                    {unseenReceivedLinks.length > 0 && (
                      <div className="flex items-center gap-2 pt-3 pb-1">
                        <h3 className="text-sm font-semibold outfit-semibold text-gray-700">
                          {linkFilter === "all"
                            ? "All Links"
                            : linkFilter === "sent"
                              ? "Sent Links"
                              : "Received Links"}
                        </h3>
                      </div>
                    )}
                    {otherLinks.map((link, index) => {
                      const preview = linkPreviews[link.link];
                      return (
                        <div
                          key={`${link.type}-${index}`}
                          className="bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleLinkClick(link)}
                        >
                          {/* Link Preview Image */}
                          {showLinkPreviews && preview?.image && (
                            <div className="w-full h-32 bg-gray-200">
                              <img
                                src={preview.image}
                                alt={preview.title || "Link preview"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-4 p-4">
                            {/* Favicon or Icon */}
                            {showLinkPreviews && preview?.favicon ? (
                              <img
                                src={preview.favicon}
                                alt=""
                                className="w-5 h-5 rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <Share2 className="w-5 h-5 text-gray-400" />
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="block font-bold outfit-bold text-sm mb-1 truncate">
                                {showLinkPreviews && preview?.title
                                  ? preview.title
                                  : link.link}
                              </p>

                              {showLinkPreviews && preview?.description && (
                                <p className="text-xs text-gray-600 outfit-normal mb-1 line-clamp-2">
                                  {preview.description}
                                </p>
                              )}

                              <p className="text-xs text-gray-500 outfit-normal">
                                {showLinkPreviews && preview?.siteName && (
                                  <span className="text-gray-400">
                                    {preview.siteName} •{" "}
                                  </span>
                                )}
                                {link.type === "shared"
                                  ? `You sent to ${link.recipients.join(", ")}`
                                  : `Shared by ${link.sender}`}
                              </p>
                            </div>

                            <div className="flex flex-col justify-between items-end gap-2 flex-shrink-0">
                              {link.type === "shared" &&
                                (link.status === "unseen"
                                  ? unseenLinkIcon
                                  : link.status === "seen"
                                    ? viewedLinkIcon
                                    : openedLinkIcon)}
                              {link.type === "received" &&
                                (link.status === "seen"
                                  ? viewedLinkIcon
                                  : openedLinkIcon)}
                              <span className="text-xs text-gray-400 outfit-normal whitespace-nowrap">
                                {getTimeAgo(link.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full -mt-5">
                <Unlink
                  strokeWidth={1.5}
                  className="w-16 h-16 mb-5 text-gray-300"
                />
                <p className="text-center text-base font-medium outfit-medium text-gray-800">
                  {showGettingStartedPrompt
                    ? "Start by adding your first friend"
                    : "No links shared yet"}
                </p>
                <p className="text-center text-sm outfit-normal text-gray-500">
                  {showGettingStartedPrompt
                    ? "If you were invited, check your email for your friend's username. You can also type your friend's email directly when adding a friend."
                    : "Your shared links would appear here."}
                </p>
                {showGettingStartedPrompt && (
                  <button
                    onClick={() => setShowAddFriend(true)}
                    className="mt-5 border border-[#6C5CE7] active:bg-[#F0E2FF] text-[#6C5CE7] font-medium outfit-medium rounded-full py-2 px-4 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add A Friend
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {activeTab === "friends" && (
          <div className="space-y-4 h-full">
            <div className="space-y-2 h-full">
              {uniqueFriends.length > 0 ? (
                <div className="w-full">
                  <button
                    onClick={() => setShowAddFriend(true)}
                    className="w-full border border-[#6C5CE7] active:bg-[#F0E2FF] text-[#6C5CE7] font-medium outfit-medium rounded-full py-2 px-4 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add/Invite a New Friend
                  </button>
                  <p className="text-gray-500 outfit-normal mt-4 mb-2">
                    Added Friends
                  </p>
                  {uniqueFriends.map((friend) => (
                    <div
                      key={friend.uid || friend.username}
                      className="flex w-full items-center justify-between p-3 bg-gray-50 rounded-lg mb-2"
                    >
                      <div className="flex items-center gap-3 justify-between w-full">
                        <div className="flex gap-3">
                          <img
                            src={friend.photoURL || "/default-avatar.png"}
                            alt={`${friend.username}'s avatar`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-medium text-sm outfit-medium">
                              {friend.displayName}
                            </p>
                            <p className="text-sm text-gray-500 outfit-normal -mt-[2px]">
                              @{friend.username}
                            </p>
                            <p className="text-xs text-gray-400 outfit-normal mt-2">
                              Added {formatAddedDate(friend.addedAt)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFriend(friend.username)}
                          disabled={isRemovingFriend}
                          className="text-red-500 outfit-normal text-xs items-center justify-center flex hover:text-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <UserMinus className="w-3 h-3 mr-1.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full -mt-5">
                  <UsersRound
                    strokeWidth={1.5}
                    className="w-12 h-12 mb-4 text-gray-300"
                  />
                  <p className="text-center text-base font-medium outfit-medium text-gray-800">
                    No friends in your sharing circle
                  </p>
                  <p className="text-center text-sm outfit-normal text-gray-500">
                    Search or invite friends to share links with.
                  </p>
                  <button
                    onClick={() => setShowAddFriend(true)}
                    className="w-3/4 border border-[#6C5CE7] active:bg-[#F0E2FF] text-[#6C5CE7] font-medium outfit-medium mt-5 rounded-full py-2 px-4 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add New Friend
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {friendToRemove && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h2 className="text-lg font-semibold outfit-semibold mb-4">
              Remove Friend
            </h2>
            <p className="mb-6 outfit-normal">
              Are you sure you want to remove {friendToRemove} from your friends
              list?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setFriendToRemove(null)}
                disabled={isRemovingFriend}
                className="px-4 py-2 border border-gray-300 rounded-md outfit-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveFriend}
                disabled={isRemovingFriend}
                className="px-4 py-2 bg-red-500 text-white rounded-md outfit-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRemovingFriend ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
