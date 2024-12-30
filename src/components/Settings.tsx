import React, { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, LogOut, Trash2, X, MoreVertical, Copy } from "lucide-react";

const inviteLink = "https://app.example.com/invite/xyz123"; // Change this value as needed

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { currentUser, signOut, deleteAccount } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
  };

  return (
    <div className="flex flex-col h-full bg-white">
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
        <div className=" p-2 bg-gray-50 rounded-lg">
        <p className="text-gray-700 outfit-normal">{currentUser?.email}</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
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
          <div className="relative flex items-center gap-3">
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
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border">
                <button
                  onClick={() => {
                    setShowDeleteDialog(true);
                    setShowKebabMenu(false);
                  }}
                  className="w-full flex gap-2 text-left px-4 outfit-normal py-2 text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete account
                </button>
              </div>
            )}
          </div>
        </div>
 
        <div className="space-y-2 border-t pt-4">
          <h4 className="text-[#6254F9] text-sm font-semibold outfit-semibold">
            Your link stats
          </h4>
          <div className="flex gap-2">
            <div className="flex p-2 border rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium outfit-medium">
                  {stats?.totalSent || 0}
                </span>
                <span className="text-gray-600 outfit-normal">Sent</span>
              </div>
            </div>
            <div className="fle p-2 border rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold outfit-semibold">
                  {stats?.totalReceived || 0}
                </span>
                <span className="text-gray-600 outfit-normal">Received</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#F5DD90] rounded-lg p-6 relative">
          <div className="flex">
            <div className="">
              <h3 className="text-lg font-semibold outfit-semibold">Bring your friends aboard</h3>
              <p className="text-gray-700 outfit-normal mb-4">
                Turn everyday links into shared discoveries with friends
              </p>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-2 outfit-medium px-4 py-2 text-[#22162B] bg-white rounded-full hover:bg-gray-50"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Invite Link
              </button>
            </div>
            <div className="w-32 absolute -bottom-3 -right-3">{/* Place for illustration */}</div>
          </div>
        </div>
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Delete Account</h3>
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to delete your account? This action cannot
              be undone and all your data will be permanently deleted.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
