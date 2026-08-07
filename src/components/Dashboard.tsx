import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  LinkSimple,
  Users,
  ShareNetwork,
  Gear,
  UserMinus,
  LinkBreak,
  UsersThree,
  FunnelSimple,
  CaretDown,
  UserPlus,
  Spinner,
  X,
  ClipboardText,
  PaperPlaneTilt,
  Heart,
  BookmarkSimple,
  TextT,
  Copy,
  DotsThreeVertical,
  PencilSimple,
  Trash,
  Check,
} from "@phosphor-icons/react";
import ShareLink from "./ShareLink";
import SettingsComponent from "./Settings";
import AddFriend from "./AddFriend";
import CustomButton from "./ui/CustomButton";
import { inviteIllus } from "../assets/image";

const extensionLandingLink = "https://linkpaddy.vercel.app/";

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
  const { currentUser, updateLinkStatus, removeFriend, acceptFriend, rejectFriend, toggleLike, toggleBookmark, editText, deleteContent, addFriend, searchUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"links" | "friends">("links");
  const [linkFilter, setLinkFilter] = useState<"all" | "sent" | "received" | "saved">(
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
  const [isRefreshingFriends, setIsRefreshingFriends] = useState(false);
  const [showShortcutTip, setShowShortcutTip] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [animatedShareId, setAnimatedShareId] = useState<string | null>(null);
  const [confirmationShareId, setConfirmationShareId] = useState<string | null>(null);
  const [openMoreId, setOpenMoreId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showNavigation, setShowNavigation] = useState(true);
  const lastScrollTop = React.useRef(0);

  // Invite state (for the "Bring your friends aboard" card)
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const RESEND_ENDPOINT = "https://linkpaddy.vercel.app/api/send-invite";

  // Detect platform
  const isMac = ((): boolean => {
    try {
      return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    } catch {
      return false;
    }
  })();

  // Show shortcut tip once (persisted)
  useEffect(() => {
    chrome.storage.local.get(["shortcutTipShown"], (result) => {
      if (!result.shortcutTipShown) {
        setShowShortcutTip(true);
      }
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["lastAnimatedShareId"], ({ lastAnimatedShareId }) => {
      if (!lastAnimatedShareId) return;
      setAnimatedShareId(lastAnimatedShareId);
      setConfirmationShareId(lastAnimatedShareId);
      chrome.storage.local.remove("lastAnimatedShareId");
      setTimeout(() => setConfirmationShareId(null), 1500);
      setTimeout(() => setAnimatedShareId(null), 2600);
    });
  }, [showShareLink]);

  const handleFeedScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    const delta = scrollTop - lastScrollTop.current;
    if (scrollTop <= 8) setShowNavigation(true);
    else if (Math.abs(delta) > 5) setShowNavigation(delta < 0);
    lastScrollTop.current = scrollTop;
  };

  const dismissShortcutTip = () => {
    setShowShortcutTip(false);
    chrome.storage.local.set({ shortcutTipShown: true });
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleOpenInviteDialog = () => {
    setInviteError(null);
    setShowInviteDialog(true);
  };

  const handleCopyInviteLink = () => {
    const username = currentUser?.username || "";
    const inviteUrl = `${extensionLandingLink}invite?ref=${encodeURIComponent("@" + username)}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2500);
    }).catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = inviteUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2500);
    });
  };

  const handleSendInviteEmail = async () => {
    if (isSendingInvite) return;
    const recipients = inviteEmails
      .split(/[;,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      setInviteError("Enter at least one email address.");
      return;
    }

    const invalid = recipients.filter((e) => !isValidEmail(e));
    if (invalid.length > 0) {
      setInviteError(`Invalid email(s): ${invalid.join(", ")}`);
      return;
    }

    setIsSendingInvite(true);
    setInviteError(null);

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: recipients, ref: currentUser?.username || "" }),
      });

      if (res.ok) {
        setShowInviteDialog(false);
        setInviteEmails("");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setInviteError((data.error as string) || "Could not send. Try again.");
    } catch {
      // Fallback to mailto
      const inviterName = currentUser?.displayName || currentUser?.username || "Your friend";
      const inviterUsername = currentUser?.username || "";
      const subject = `${inviterName} invited you to LinkPaddy`;
      const body = `Hey,\n\n${inviterName} invited you to LinkPaddy so you can share links together.\n\nGet the extension for your browser: ${extensionLandingLink}\n\nAfter signing up, add your friend with this username: @${inviterUsername}\n\nSee you there!`;
      const mailtoUrl = `mailto:${recipients.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, "_blank");
      setShowInviteDialog(false);
      setInviteEmails("");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const showLinkPreviews = currentUser?.settings?.showLinkPreviews ?? true;

  const sortedLinks = useMemo(() => {
    if (!currentUser) return [];
    const allLinks = [
      ...(currentUser.sharedLinks || []).map((link) => ({
        ...link,
        type: "shared" as const,
      })),
      ...(currentUser.receivedLinks || [])
        .filter((link: any) => !link.kind || (link.kind !== "friend_added" && !link.kind.startsWith("friend_request_")))
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
    if (linkFilter === "saved") return sortedLinks.filter((link) => currentUser?.bookmarkedLinkIds?.includes(link.id));
    return sortedLinks.filter((link) => link.type === "received");
  }, [sortedLinks, linkFilter, currentUser?.bookmarkedLinkIds]);

  // Separate unseen received links
  const unseenReceivedLinks = useMemo(() => {
    return filteredLinks.filter(
      (link) => link.type === "received" && link.status === "unseen",
    );
  }, [filteredLinks]);

  const getDateLabel = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "A week ago";
    if (diffDays < 30) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    const months = Math.floor(diffDays / 30);
    if (months === 1) return "A month ago";
    if (months < 12) return `${months} months ago`;
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const otherLinks = useMemo(() => {
    return filteredLinks.filter(
      (link) => !(link.type === "received" && link.status === "unseen"),
    );
  }, [filteredLinks]);

  const groupedOtherLinks = useMemo(() => {
    const groups: { label: string; links: typeof otherLinks }[] = [];
    let currentLabel = "";
    for (const link of otherLinks) {
      const label = getDateLabel(link.timestamp);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, links: [] });
      }
      groups[groups.length - 1].links.push(link);
    }
    return groups;
  }, [otherLinks]);

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

  // Resolve a stale sender username to the friend's current display name
  const friendDisplayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    uniqueFriends.forEach((f) => {
      const key = (f.username || "").toLowerCase();
      if (key) map.set(key, f.displayName || f.username || key);
    });
    return map;
  }, [uniqueFriends]);

  const acceptedFriends = useMemo(() => {
    return uniqueFriends.filter((f) => !f.status || f.status === "accepted" || f.status === "auto");
  }, [uniqueFriends]);

  const pendingReceivedRequests = useMemo(() => {
    const byUsername = new Map<string, (typeof uniqueFriends)[number]>();

    uniqueFriends
      .filter((f) => f.status === "request_received")
      .forEach((friend) => {
        const username =
          typeof friend.username === "string"
            ? friend.username.trim().replace(/^@/, "").toLowerCase()
            : "";
        if (username) {
          byUsername.set(username, friend);
        }
      });

    (currentUser?.receivedLinks || [])
      .filter(
        (link: any) =>
          link.kind === "friend_request_received" &&
          link.sender &&
          link.status === "unseen",
      )
      .forEach((link: any) => {
        const username = String(link.sender).trim().replace(/^@/, "").toLowerCase();
        if (!username || byUsername.has(username)) return;

        byUsername.set(username, {
          uid: link.senderProfile?.uid,
          username,
          displayName: link.senderProfile?.displayName || username,
          email: link.senderProfile?.email || "",
          photoURL: link.senderProfile?.photoURL || "",
          addedAt: link.timestamp || new Date().toISOString(),
          status: "request_received",
        });
      });

    return Array.from(byUsername.values());
  }, [uniqueFriends, currentUser?.receivedLinks]);

  const pendingSentRequests = useMemo(() => {
    return uniqueFriends.filter((f) => f.status === "request_sent");
  }, [uniqueFriends]);

  const hasNoLinks =
    (currentUser?.sharedLinks?.length || 0) +
      (currentUser?.receivedLinks?.length || 0) ===
    0;
  const hasNoFriends = acceptedFriends.length === 0;
  const showGettingStartedPrompt = hasNoLinks && hasNoFriends;

  // Refresh friends data when switching to friends tab
  useEffect(() => {
    if (activeTab === "friends") {
      console.log("Switched to friends tab, triggering data refresh...");
      chrome.runtime.sendMessage({ type: "REFRESH_DATA" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Failed to trigger refresh:", chrome.runtime.lastError.message);
        }
      });

      if (currentUser?.uid) {
        setIsRefreshingFriends(true);
        chrome.runtime.sendMessage(
          { type: "REFRESH_FRIEND_PROFILES", uid: currentUser.uid },
          (response: any) => {
            setIsRefreshingFriends(false);
            if (chrome.runtime.lastError) {
              console.warn("Failed to refresh friend profiles:", chrome.runtime.lastError.message);
              return;
            }
            if (response?.updated && response?.changes?.length > 0) {
              response.changes.forEach((change: any) => {
                const msg = change.oldUsername
                  ? `@${change.oldUsername} → @${change.username} updated their username`
                  : `@${change.username} updated their profile`;
                console.log(msg);
              });
            }
          },
        );
      }
    }
  }, [activeTab, currentUser?.uid]);

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
        .filter((link) => link.link && !linkPreviews[link.link])
        .slice(0, 10); // Limit to 10 at a time

      await Promise.all(
        linksToFetch.map(async (link) => {
          const preview = await fetchPreview(link.link!);
          previews[link.link!] = preview;
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

  const copyValue = async (link: any) => {
    await navigator.clipboard.writeText(link.contentType === "text" ? link.text || "" : link.link || "");
    setCopiedId(link.id);
    setToast(link.contentType === "text" ? "Text copied" : "Link copied");
    setTimeout(() => { setCopiedId(null); setToast(null); }, 1800);
  };

  const handleLinkClick = async (link: any) => {
    if (link.contentType === "text") {
      await copyValue(link);
      return;
    }
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

  const toggleItemLike = async (event: React.MouseEvent, link: any) => {
    event.stopPropagation();
    await toggleLike(link.id, !(link.likedBy || []).includes(currentUser.username));
  };

  const toggleItemBookmark = async (event: React.MouseEvent, link: any) => {
    event.stopPropagation();
    await toggleBookmark(link.id, !currentUser.bookmarkedLinkIds?.includes(link.id));
  };

  const copyItem = async (event: React.MouseEvent, link: any) => {
    event.stopPropagation();
    await copyValue(link);
  };

  const startEditing = (event: React.MouseEvent, link: any) => {
    event.stopPropagation();
    setEditingItem(link);
    setEditDraft(link.text || "");
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    await editText(editingItem.id, editDraft);
    setEditingItem(null);
  };

  const removeItem = async (event: React.MouseEvent, link: any) => {
    event.stopPropagation();
    if (window.confirm("Delete this item for everyone?")) await deleteContent(link.id);
  };

  const isBookmarked = (linkId: string) => currentUser.bookmarkedLinkIds?.includes(linkId) || false;
  const selectedProfileRelationship = selectedProfile
    ? currentUser.friends?.find((friend) => friend.uid === selectedProfile.uid || friend.username === selectedProfile.username)
    : undefined;

  const getRecipients = (link: any) => {
    const statuses = Array.isArray(link.recipientStatuses) ? link.recipientStatuses : [];
    const profiles = Array.isArray(link.recipientProfiles) ? link.recipientProfiles : [];
    const legacyRecipients = Array.isArray(link.recipients) ? link.recipients : [];
    const byUsername = new Map<string, any>();

    [...profiles, ...statuses].forEach((person) => {
      if (!person?.username) return;
      byUsername.set(person.username, { ...byUsername.get(person.username), ...person });
    });
    legacyRecipients.forEach((username: string) => {
      if (!byUsername.has(username)) {
        byUsername.set(username, {
          username,
          displayName: resolveSenderLabel(username),
          status: link.status || "unseen",
        });
      }
    });
    return Array.from(byUsername.values());
  };

  const getOtherRecipients = (link: any) =>
    getRecipients(link).filter(
      (person) => person.username?.toLowerCase() !== currentUser.username?.toLowerCase(),
    );

  const openRecipientProfile = async (person: any) => {
    const username = String(person.username || "").toLowerCase();
    const localFriend = currentUser.friends?.find(
      (friend) => friend.uid === person.uid || friend.username?.toLowerCase() === username,
    );
    const initialProfile = { ...person, ...localFriend, username };
    setSelectedProfile(initialProfile);
    if (initialProfile.photoURL && initialProfile.joinedAt) return;

    setIsLoadingProfile(true);
    try {
      const exactProfile = (await searchUser(username)).find(
        (user) => user.username?.toLowerCase() === username,
      );
      if (exactProfile) {
        setSelectedProfile((current: any) => current?.username === username ? {
          ...current,
          uid: exactProfile.uid,
          displayName: exactProfile.displayName || current.displayName,
          photoURL: exactProfile.photoURL || current.photoURL,
          joinedAt: (exactProfile as any).joinedAt || current.joinedAt,
        } : current);
      }
    } catch (error) {
      console.warn("Could not load recipient profile:", username, error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const itemActions = (link: any, onPreview = false) => (
    <div className={`relative flex items-center gap-0.5 rounded-full p-0.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity ${onPreview ? "bg-black/60 text-white backdrop-blur-sm" : "bg-gray-100 text-gray-600"}`}>
      {link.contentType !== "text" && <button title="Like" onClick={(event) => toggleItemLike(event, link)} className={`rounded-full p-1.5 hover:bg-white/20 ${(link.likedBy || []).includes(currentUser.username || "") ? "text-rose-400" : "text-current"}`}><Heart weight={(link.likedBy || []).includes(currentUser.username || "") ? "fill" : "regular"} className="h-[19px] w-[19px]" /></button>}
      <button title="More options" onClick={(event) => { event.stopPropagation(); setOpenMoreId(openMoreId === link.id ? null : link.id); }} className="rounded-full p-1.5 text-current hover:bg-white/20"><DotsThreeVertical className="h-[19px] w-[19px]" /></button>
      {openMoreId === link.id && <div className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-gray-100 bg-white p-1 text-left shadow-lg">
        <button onClick={(event) => copyItem(event, link)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs hover:bg-gray-50"><Copy className="h-3.5 w-3.5" /> {link.contentType === "text" ? "Copy text" : "Copy link"}</button>
        {link.contentType !== "text" && <button onClick={(event) => toggleItemBookmark(event, link)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs hover:bg-gray-50"><BookmarkSimple className="h-3.5 w-3.5" /> {isBookmarked(link.id) ? "Unsave" : "Bookmark"}</button>}
        {link.type === "shared" && link.contentType === "text" && <button onClick={(event) => startEditing(event, link)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs hover:bg-gray-50"><PencilSimple className="h-3.5 w-3.5" /> Edit text</button>}
        {link.type === "shared" && <button onClick={(event) => removeItem(event, link)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-red-600 hover:bg-red-50"><Trash className="h-3.5 w-3.5" /> Delete</button>}
      </div>}
    </div>
  );

  const resolveSenderLabel = (sender: string) => {
    const key = (sender || "").replace(/^@/, "").toLowerCase();
    return friendDisplayNameMap.get(key) || sender;
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
          <CustomButton
            onClick={() => setShowShareLink(true)}
            variant="primary"
            size="md"
            className="rounded-full px-5 py-2.5 font-medium"
            showArrow={false}
            trailingIcon={<ShareNetwork className="w-4 h-4" />}
          >
            Share anything
          </CustomButton>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <Gear className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className={`shrink-0 overflow-hidden transition-all duration-300 ease-out ${showNavigation ? "max-h-24 translate-y-0 opacity-100" : "max-h-0 -translate-y-full opacity-0"}`}>
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
            <LinkSimple className="w-4 h-4" />
            My Links
          </button>
          <button
            onClick={() => setActiveTab("friends")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full outfit-normal relative ${
              activeTab === "friends"
                ? "bg-gray-900 text-white font-medium outfit-medium"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>My Network</span>
            {pendingReceivedRequests.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white leading-none">
                {pendingReceivedRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter dropdown - only show when on links tab */}
        {activeTab === "links" && (
          <div className="relative inline-flex items-center justify-center p-2 hover:bg-gray-100 rounded-full cursor-pointer">
            <FunnelSimple className="w-5 h-5 text-gray-600" />
            <select
              value={linkFilter}
              onChange={(e) =>
                setLinkFilter(e.target.value as "all" | "sent" | "received" | "saved")
              }
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Filter links"
            >
              <option value="all">All Links</option>
              <option value="sent">Sent Links</option>
              <option value="received">Received Links</option>
              <option value="saved">Saved</option>
            </select>
          </div>
        )}
      </div>
      </div>

      <div className="flex-1 px-4 pb-6 pt-0 overflow-auto" onScroll={handleFeedScroll}>
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
                      const preview = link.link ? linkPreviews[link.link] : undefined;
                      return (
                        <div
                          key={`unseen-${link.type}-${index}`}
                           className={`group bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors relative ${animatedShareId === link.id ? "animate-share-in" : ""}`}
                          onClick={() => handleLinkClick(link)}
                        >
                          {/* Blue dot indicator */}
                          <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-[#6C5CE7] z-10"></div>

                          {/* Link Preview Image */}
                           {showLinkPreviews && preview?.image && (
                             <div className="relative w-full h-32 rounded-t-xl bg-gray-200">
                               <img
                                src={preview.image}
                                alt={preview.title || "Link preview"}
                                className="w-full h-full rounded-t-xl object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                               />
                               <div className="absolute right-3 top-3 z-20">
                                 {itemActions(link, true)}
                               </div>
                             </div>
                           )}

                          <div className="flex items-center gap-4 p-4">
                            {/* Favicon or Icon */}
                            {confirmationShareId === link.id ? (
                              <span className="sent-check-icon flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white"><Check className="h-4 w-4" weight="bold" /></span>
                            ) : link.contentType === "text" ? (
                              <TextT className="w-5 h-5 text-[#6C5CE7]" />
                            ) : showLinkPreviews && preview?.favicon ? (
                              <img
                                src={preview.favicon}
                                alt=""
                                className={`w-5 h-5 rounded ${animatedShareId === link.id ? "favicon-reveal" : ""}`}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <ShareNetwork className="w-5 h-5 text-gray-400" />
                            )}

                            <div className="flex-1 min-w-0">
                              {editingItem?.id === link.id ? <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} onClick={(event) => event.stopPropagation()} className="w-full min-h-20 rounded-lg border border-gray-200 p-2 text-sm" /> : <p className={`block text-sm mb-1 ${link.contentType === "text" ? "text-card-preview font-medium" : "font-bold truncate"}`}>
                                {link.contentType === "text"
                                  ? link.text
                                  : showLinkPreviews && preview?.title
                                  ? preview.title
                                  : link.link}
                              </p>}

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
                                {getOtherRecipients(link).length > 0 ? (
                                  <span className="group/recipients relative inline-block" tabIndex={0}>
                                    <span>Shared by {resolveSenderLabel(link.sender)} with {getOtherRecipients(link).map((person: any) => person.displayName?.split(" ")[0] || person.username).join(", ")}</span>
                                    <span className="absolute left-0 bottom-[calc(100%-2px)] hidden group-hover/recipients:block group-focus/recipients:block z-20 w-60 rounded-xl bg-gray-900 p-3 text-left text-xs text-white shadow-xl">
                                      <span className="block font-semibold mb-1.5">Shared with</span>
                                      {getOtherRecipients(link).map((person: any) => (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openRecipientProfile(person);
                                          }}
                                          key={person.username}
                                          className="block w-full rounded-md px-1 py-1 text-left hover:bg-white/10"
                                        >
                                          {person.displayName?.split(" ")[0] || person.username}
                                        </button>
                                      ))}
                                    </span>
                                  </span>
                                ) : `Shared by ${resolveSenderLabel(link.sender)}`}
                              </p>
                            </div>

                            <div className="flex flex-col justify-between items-end gap-2 flex-shrink-0">
                              <span className="text-xs bg-[#6C5CE7] text-white px-2 py-0.5 rounded-full">
                                New
                              </span>
                              <div className="relative flex h-9 min-w-[74px] items-center justify-end">
                                {!(showLinkPreviews && preview?.image) && itemActions(link)}
                              </div>
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

                {/* Grouped links by date */}
                {groupedOtherLinks.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 pt-3 pb-1">
                      <h3 className="text-xs font-semibold outfit-semibold text-gray-400 uppercase tracking-wider">
                        {group.label}
                      </h3>
                    </div>
                    {group.links.map((link, index) => {
                      const preview = link.link ? linkPreviews[link.link] : undefined;
                      return (
                        <div
                          key={`${link.type}-${group.label}-${index}`}
                          className={`group relative bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors mb-2 ${animatedShareId === link.id ? "animate-share-in" : ""}`}
                          onClick={() => handleLinkClick(link)}
                        >
                          {/* Link Preview Image */}
                          {showLinkPreviews && preview?.image && (
                            <div className="relative w-full h-32 rounded-t-xl bg-gray-200">
                              <img
                                src={preview.image}
                                alt={preview.title || "Link preview"}
                                className="w-full h-full rounded-t-xl object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                              <div className="absolute right-3 top-3 z-20">
                                {itemActions(link, true)}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-4 p-4">
                            {/* Favicon or Icon */}
                            {confirmationShareId === link.id ? (
                              <span className="sent-check-icon flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white"><Check className="h-4 w-4" weight="bold" /></span>
                            ) : link.contentType === "text" ? (
                              <TextT className="w-5 h-5 text-[#6C5CE7]" />
                            ) : showLinkPreviews && preview?.favicon ? (
                              <img
                                src={preview.favicon}
                                alt=""
                                className={`w-5 h-5 rounded ${animatedShareId === link.id ? "favicon-reveal" : ""}`}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <ShareNetwork className="w-5 h-5 text-gray-400" />
                            )}

                            <div className="flex-1 min-w-0">
                              {editingItem?.id === link.id ? <div onClick={(event) => event.stopPropagation()}><textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={1000} className="w-full min-h-20 rounded-lg border border-gray-200 p-2 text-sm" /><div className="flex gap-2 mt-2"><button onClick={saveEdit} className="text-xs rounded-full bg-gray-900 px-3 py-1.5 text-white">Save</button><button onClick={(event) => { event.stopPropagation(); setEditingItem(null); }} className="text-xs rounded-full bg-gray-200 px-3 py-1.5">Cancel</button></div></div> : <p className={`block text-sm mb-1 ${link.contentType === "text" ? "text-card-preview font-medium" : "font-bold truncate"}`}>
                                {link.contentType === "text"
                                  ? link.text
                                  : showLinkPreviews && preview?.title
                                  ? preview.title
                                  : link.link}
                              </p>}

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
                                {link.type === "shared" ? (
                                  <span className="group/recipients relative inline-block" tabIndex={0}>
                                    <span className="underline decoration-dotted underline-offset-2">Sent to {getRecipients(link).map((person: any) => person.displayName?.split(" ")[0] || person.username).join(", ")}</span>
                                    <span className="absolute left-0 bottom-[calc(100%-2px)] hidden group-hover/recipients:block group-focus/recipients:block z-20 w-60 rounded-xl bg-gray-900 p-3 text-left text-xs text-white shadow-xl">
                                      <span className="block font-semibold mb-1.5">Recipients</span>
                                      {getRecipients(link).map((person: any) => <button type="button" onClick={(event) => { event.stopPropagation(); openRecipientProfile(person); }} key={person.username} className="flex w-full justify-between rounded-md px-1 py-1 text-left hover:bg-white/10"><span>{person.displayName?.split(" ")[0] || person.username}</span><span className="text-gray-400 capitalize">{person.status === "unseen" ? "Not seen" : person.status || "Recipient"}</span></button>)}
                                    </span>
                                  </span>
                                ) : getOtherRecipients(link).length > 0 ? (
                                  <span className="group/recipients relative inline-block" tabIndex={0}>
                                    <span>Shared by {resolveSenderLabel(link.sender)} with {getOtherRecipients(link).map((person: any) => person.displayName?.split(" ")[0] || person.username).join(", ")}</span>
                                    <span className="absolute left-0 bottom-[calc(100%-2px)] hidden group-hover/recipients:block group-focus/recipients:block z-20 w-60 rounded-xl bg-gray-900 p-3 text-left text-xs text-white shadow-xl">
                                      <span className="block font-semibold mb-1.5">Shared with</span>
                                      {getOtherRecipients(link).map((person: any) => <button type="button" onClick={(event) => { event.stopPropagation(); openRecipientProfile(person); }} key={person.username} className="block w-full rounded-md px-1 py-1 text-left hover:bg-white/10">{person.displayName?.split(" ")[0] || person.username}</button>)}
                                    </span>
                                  </span>
                                ) : `Shared by ${resolveSenderLabel(link.sender)}`}
                              </p>
                            </div>

                            <div className="flex min-h-14 w-[82px] flex-col justify-between items-end gap-2 flex-shrink-0">
                              <div className="relative flex h-9 w-full items-center justify-end">
                              <div className="absolute right-0 group-hover:hidden group-focus-within:hidden">
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
                              </div>
                              {!(showLinkPreviews && preview?.image) && <div className="absolute right-0 top-0">{itemActions(link)}</div>}
                              </div>
                              <span className="text-xs text-gray-400 outfit-normal whitespace-nowrap">
                                {getTimeAgo(link.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full -mt-5">
                <LinkBreak
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
                  <CustomButton
                    onClick={() => setShowAddFriend(true)}
                    variant="outlinePrimary"
                    className="mt-5"
                    showArrow={false}
                    trailingIcon={<UserPlus className="w-4 h-4" />}
                  >
                    Add A Friend
                  </CustomButton>
                )}
              </div>
            )}
          </div>
        )}
        {activeTab === "friends" && (
          <div className="space-y-4 h-full pb-4">
            <div className="space-y-2 h-full">
              {isRefreshingFriends && (
                <div className="flex items-center gap-2 py-1.5 px-3 text-xs text-gray-500 bg-gray-50 rounded-lg">
                  <Spinner className="w-3.5 h-3.5 animate-spin" />
                  Refreshing friend profiles...
                </div>
              )}
              {acceptedFriends.length > 0 || pendingReceivedRequests.length > 0 || pendingSentRequests.length > 0 ? (
                <div className="w-full">
                  <div className="relative mb-4 overflow-hidden rounded-lg bg-[#F5DD90] px-5 py-6">
                    <div className="flex">
                      <div className="w-3/5">
                        <h3 className="text-lg font-semibold outfit-semibold">
                          Bring your friends aboard
                        </h3>
                        <p className="mb-4 text-gray-700 outfit-normal">
                          Turn everyday links into shared discoveries with friends
                        </p>
                        <CustomButton
                          onClick={handleOpenInviteDialog}
                          variant="onPrimary"
                          size="sm"
                          className="text-[#22162B]"
                          showArrow={false}
                          trailingIcon={<UserPlus className="w-4 h-4" />}
                        >
                          Invite some friends
                        </CustomButton>
                      </div>
                      <div className="absolute -bottom-1.5 right-0 w-36">
                        <img
                          src={inviteIllus}
                          alt="Link sharing illustration"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <CustomButton
                    onClick={() => setShowAddFriend(true)}
                    variant="outlinePrimary"
                    fullWidth
                    showArrow={false}
                    trailingIcon={<UserPlus className="w-4 h-4" />}
                  >
                    Add/Invite a New Friend
                  </CustomButton>

                  {/* Pending Received Requests */}
                  {pendingReceivedRequests.length > 0 && (
                    <div className="mt-6">
                      <p className="text-gray-500 outfit-normal font-medium text-xs mb-2.5">
                        Pending Friend Requests ({pendingReceivedRequests.length})
                      </p>
                      {pendingReceivedRequests.map((friend) => (
                        <div
                          key={`received-${friend.uid || friend.username}`}
                          className="flex w-full items-center justify-between p-3 bg-indigo-50/40 border border-indigo-100/60 rounded-xl mb-2"
                        >
                          <div className="flex items-center gap-3 justify-between w-full">
                            <div className="flex gap-3">
                              <img
                                src={friend.photoURL || "/default-avatar.png"}
                                alt={`${friend.username}'s avatar`}
                                className="w-10 h-10 rounded-full object-cover border border-indigo-200"
                              />
                              <div>
                                <p className="font-semibold text-sm outfit-semibold">
                                  {friend.displayName}
                                </p>
                                <p className="text-sm text-gray-500 outfit-normal -mt-[2px]">
                                  @{friend.username}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <CustomButton
                                onClick={async () => {
                                  try {
                                    await acceptFriend(friend.username);
                                  } catch (err) {
                                    console.error("Accept friend error:", err);
                                  }
                                }}
                                variant="primary"
                                size="sm"
                                showArrow={false}
                                className="text-xs px-3 py-1.5 rounded-full"
                              >
                                Accept
                              </CustomButton>
                              <CustomButton
                                onClick={async () => {
                                  try {
                                    await rejectFriend(friend.username);
                                  } catch (err) {
                                    console.error("Decline friend error:", err);
                                  }
                                }}
                                variant="neutral"
                                size="sm"
                                showArrow={false}
                                className="text-xs px-3 py-1.5 rounded-full"
                              >
                                Decline
                              </CustomButton>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Added Friends */}
                  {acceptedFriends.length > 0 && (
                    <div className="mt-6">
                      <p className="text-gray-500 outfit-normal font-medium mb-2">
                        Added Friends ({acceptedFriends.length})
                      </p>
                      {acceptedFriends.map((friend) => (
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
                            <CustomButton
                              onClick={() => handleRemoveFriend(friend.username)}
                              disabled={isRemovingFriend}
                              variant="subtleDanger"
                              size="sm"
                              showArrow={false}
                              className="text-xs"
                            >
                              Remove
                            </CustomButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending Sent Requests */}
                  {pendingSentRequests.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <p className="text-gray-400 font-semibold text-[10px] mb-2 uppercase tracking-wider">
                        Sent Requests (Pending)
                      </p>
                      {pendingSentRequests.map((friend) => (
                        <div
                          key={`sent-${friend.uid || friend.username}`}
                          className="flex w-full items-center justify-between p-2.5 bg-gray-50/50 rounded-xl mb-2 opacity-75"
                        >
                          <div className="flex items-center gap-3 justify-between w-full">
                            <div className="flex gap-3">
                              <img
                                src={friend.photoURL || "/default-avatar.png"}
                                alt={`${friend.username}'s avatar`}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                              <div>
                                <p className="font-medium text-xs outfit-medium">
                                  {friend.displayName}
                                </p>
                                <p className="text-xs text-gray-500 outfit-normal -mt-[2px]">
                                  @{friend.username}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 outfit-normal italic">
                              Request Sent
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full -mt-5">
                  <UsersThree
                    strokeWidth={1.5}
                    className="w-12 h-12 mb-4 text-gray-300"
                  />
                  <p className="text-center text-base font-medium outfit-medium text-gray-800">
                    No friends in your network
                  </p>
                  <p className="text-center text-sm outfit-normal text-gray-500">
                    Search or invite friends to share links with.
                  </p>
                  <CustomButton
                    onClick={() => setShowAddFriend(true)}
                    variant="outlinePrimary"
                    className="w-3/4 mt-5"
                    showArrow={false}
                    trailingIcon={<UserPlus className="w-4 h-4" />}
                  >
                    Add New Friend
                  </CustomButton>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showShortcutTip && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900 text-white py-3 px-4 flex items-center justify-between gap-3 z-10 rounded-t-xl shadow-lg">
          <div className="flex items-center gap-2 text-sm outfit-normal min-w-0">
            <svg className="w-5 h-5 shrink-0 text-[#A78BFA]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 12h16"></path></svg>
            <span className="truncate">
              <span className="opacity-70">Quick share: Press </span>
              {isMac ? (
                <span className="font-semibold">Alt+Shift+L</span>
              ) : (
                <span className="font-semibold">Ctrl+Space</span>
              )}
              <span className="opacity-70"> to send the current tab</span>
            </span>
          </div>
          <button
            onClick={dismissShortcutTip}
            className="p-1 hover:bg-white/10 rounded-full shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {showInviteDialog && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold outfit-semibold text-gray-900">
                Invite Friends By Email
              </h3>
              <button
                onClick={() => {
                  setShowInviteDialog(false);
                  setInviteError(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 outfit-normal mb-3">
              Enter your friends' emails and we'll send them an invite to LinkPaddy.
            </p>

            <textarea
              value={inviteEmails}
              onChange={(e) => {
                setInviteEmails(e.target.value);
                if (inviteError) setInviteError(null);
              }}
              placeholder="friend1@email.com, friend2@email.com"
              className="w-full min-h-24 resize-none border border-gray-200 rounded-lg p-3 text-sm outfit-normal focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]"
            />

            {inviteError && (
              <p className="text-red-500 text-xs outfit-normal mt-2">
                {inviteError}
              </p>
            )}

            <div className="flex gap-3 justify-end mt-5">
              <CustomButton
                onClick={() => {
                  setShowInviteDialog(false);
                  setInviteError(null);
                }}
                variant="neutral"
                showArrow={false}
                disabled={isSendingInvite}
              >
                Cancel
              </CustomButton>
              <CustomButton
                onClick={handleSendInviteEmail}
                disabled={isSendingInvite}
                variant="primary"
                className="outfit-semibold"
                showArrow={false}
                trailingIcon={<PaperPlaneTilt className="w-4 h-4" />}
              >
                {isSendingInvite ? "Sending..." : "Send Invites"}
              </CustomButton>
            </div>
          </div>
        </div>
      )}

      {selectedProfile && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-5" onClick={() => setSelectedProfile(null)}>
          <div className="w-full rounded-lg bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 shrink-0">
                  <img src={selectedProfile.photoURL || "/default-avatar.png"} alt="" className="h-11 w-11 rounded-full object-cover" />
                  {isLoadingProfile && <Spinner className="absolute inset-0 m-auto h-5 w-5 animate-spin text-[#6C5CE7]" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedProfile.displayName || selectedProfile.username}</p>
                  <p className="text-sm text-gray-500">@{selectedProfile.username}</p>
                </div>
              </div>
              <button title="Close profile" onClick={() => setSelectedProfile(null)} className="rounded-full p-1.5 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-4 text-xs text-gray-500">{selectedProfile.joinedAt ? `Joined ${new Date(selectedProfile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "Join date unavailable"}</p>
            {selectedProfile.uid !== currentUser.uid && (
              <CustomButton onClick={async () => { if (!selectedProfileRelationship) await addFriend(selectedProfile.username, selectedProfile.uid); setSelectedProfile(null); }} disabled={!!selectedProfileRelationship} variant="primary" fullWidth className="mt-4" showArrow={false} trailingIcon={<UserPlus className="h-4 w-4" />}>{selectedProfileRelationship?.status === "request_sent" ? "Request sent" : selectedProfileRelationship ? "Already friends" : "Add friends"}</CustomButton>
            )}
          </div>
        </div>
      )}

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
              <CustomButton
                onClick={() => setFriendToRemove(null)}
                disabled={isRemovingFriend}
                variant="neutral"
                showArrow={false}
              >
                Cancel
              </CustomButton>
              <CustomButton
                onClick={confirmRemoveFriend}
                disabled={isRemovingFriend}
                variant="danger"
                showArrow={false}
              >
                {isRemovingFriend ? "Removing..." : "Remove"}
              </CustomButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
