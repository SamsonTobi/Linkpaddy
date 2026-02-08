import React, { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeft,
  LogOut,
  Trash2,
  X,
  MoreVertical,
  Copy,
  ArrowDownToDot,
  ArrowUpFromDot,
  Check,
} from "lucide-react";
import inviteIllus from "../assets/invite-illus.png"; // Adjust the path as necessary

const inviteLink = "https://app.example.com/invite/xyz123"; // Change this value as needed

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { currentUser, signOut, deleteAccount, updateSettings } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const showLinkPreviews = currentUser?.settings?.showLinkPreviews ?? true;

  const handleTogglePreviews = async () => {
    try {
      await updateSettings({ showLinkPreviews: !showLinkPreviews });
    } catch (error) {
      console.error("Failed to update preview setting:", error);
    }
  };

  const stats = useMemo(() => {
    if (!currentUser) return null;
    const receivedLinks = currentUser.receivedLinks || [];
    const sharedLinks = currentUser.sharedLinks || [];
    const totalReceived = receivedLinks.length;
    const totalSent = sharedLinks.length;
    const unopenedReceived = receivedLinks.filter(
      (link) => link.status === "unseen"
    ).length;
    const mostRecentLink = [...receivedLinks, ...sharedLinks].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
    return {
      totalReceived,
      totalSent,
      unopenedReceived,
      mostRecentLink: mostRecentLink
        ? new Date(mostRecentLink.timestamp).toLocaleDateString()
        : "N/A",
    };
  }, [currentUser]);

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await deleteAccount();
    } catch (error) {
      console.error("Error deleting account:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className="flex flex-col h-full bg-white"
      onClick={() => setShowKebabMenu(false)}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold outfit-semibold">Settings</h2>
        </div>
        <div className=" py-2 px-3 bg-gray-50 rounded-lg">
          <p className="text-gray-600 outfit-normal">{currentUser?.email}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border">
              <img
                src={currentUser?.photoURL || "/default-avatar.png"}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="font-medium outfit-medium text-lg">
                {currentUser?.displayName}
              </h3>
              <p className="text-gray-600 outfit-normal -mt-1">
                @{currentUser?.username}
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-1">
            <button
              onClick={signOut}
              className="w-full flex items-center rounded-full justify-center gap-2 py-2 px-4 text-red-500 bg-red-50 outfit-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>

            <button
              onClick={() => setShowKebabMenu(!showKebabMenu)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showKebabMenu && (
              <div className="absolute right-0 mt-20 w-40 bg-white rounded-lg shadow-lg border">
                <button
                  onClick={() => {
                    setShowDeleteDialog(true);
                    setShowKebabMenu(false);
                  }}
                  className="w-full flex gap-2 text-left px-4 outfit-normal py-2 text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete account
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t pt-4 mb-3">
          <h4 className="text-[#6254F9] text-sm font-medium outfit-medium">
            Your Link Stats
          </h4>
          <div className="flex gap-2">
            <div className="flex py-2 px-4 border rounded-lg">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-medium outfit-medium">
                  {stats?.totalSent || 0}
                </span>
                <span className="flex items-center text-gray-600 outfit-normal">
                  Sent
                  <ArrowUpFromDot strokeWidth={1.7} className="w-3 h-3 ml-1" />
                </span>
              </div>
            </div>
            <div className="fle py-2 px-4 border rounded-lg">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-semibold outfit-semibold">
                  {stats?.totalReceived || 0}
                </span>
                <span className="flex items-center text-gray-600 outfit-normal">
                  Received
                  <ArrowDownToDot strokeWidth={1.7} className="w-3 h-3 ml-1" />
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div>
              <p className="text-sm font-medium outfit-medium text-gray-800">Show Link Previews</p>
              <p className="text-xs text-gray-500 outfit-normal">Display website previews in link cards</p>
            </div>
            <button
              onClick={handleTogglePreviews}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showLinkPreviews ? "bg-[#6C5CE7]" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showLinkPreviews ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="bg-[#F5DD90] rounded-lg px-5 py-6 relative overflow-hidden">
          <div className="flex">
            <div className="w-3/5">
              <h3 className="text-lg font-semibold outfit-semibold">
                Bring your friends aboard
              </h3>
              <p className="text-gray-700 outfit-normal mb-4">
                Turn everyday links into shared discoveries with friends
              </p>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-2 outfit-medium px-4 py-2 text-[#22162B] bg-white rounded-full hover:bg-gray-50"
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-[#45A134]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {isCopied ? "Copied!" : "Copy Invite Link"}
              </button>
            </div>
            <div className="w-36 absolute -bottom-1.5 right-0">
              <img
                src={inviteIllus}
                alt="Link sharing illustration"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold outfit-semibold text-gray-900">
                Permanently Delete Your Account
              </h3>
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setShowKebabMenu(!showKebabMenu);
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-700 font-medium outfit-medium">
                Before you go, please be aware that deleting your account will:
              </p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-600 mt-2"></span>
                  <span className="outfit-normal">
                    Remove all your shared and received links
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-600 mt-2"></span>
                  <span className="outfit-normal">
                    Delete your profile information and settings
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-600 mt-2"></span>
                  <span className="outfit-normal">
                    End all active connections with other users
                  </span>
                </li>
                {/* <li className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-gray-600 mt-2"></span>
            <span className="outfit-normal">Remove access to any saved collections or favorites</span>
          </li> */}
              </ul>

              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-xs outfit-normal text-gray-700">
                <p className="font-medium mb-1">
                  Your data cannot be recovered once deleted.
                </p>
              </div>

              <p className="text-gray-600 text-xs outfit-normal">
                If you're experiencing issues with the platform, consider
                logging out temporarily or contacting our support team instead.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setShowKebabMenu(!showKebabMenu);
                }}
                className="px-4 py-2 outfit-medium rounded-full border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 outfit-semibold text-white rounded-full hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
