import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeft,
  MagnifyingGlass,
  ArrowElbowDownLeft,
  Spinner,
  UserPlus,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import CustomButton from "./ui/CustomButton";

interface AddFriendProps {
  onBack: () => void;
}

interface SearchResult {
  uid?: string;
  username: string;
  email: string;
}

interface ToastProps {
  message: string;
  type: "success" | "error";
}

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col gap-3 items-center justify-center h-full bg-white mt-7">
    <Spinner className="w-10 h-10 text-gray-300 animate-spin" />
    <p className="font-medium outfit-medium">Searching...</p>
  </div>
);

const Toast: React.FC<ToastProps> = ({ message, type }) => (
  <div
    className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 p-4 rounded-lg outfit-medium shadow-lg text-center ${
      type === "success" ? "bg-gray-700 text-white" : "bg-red-500 text-white"
    }`}
  >
    <span>{message}</span>
  </div>
);

const AddFriend: React.FC<AddFriendProps> = ({ onBack }) => {
  const { searchUser, addFriend } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSearchPrompt, setShowSearchPrompt] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  useEffect(() => {
    if (searchTerm) {
      setShowSearchPrompt(true);
    } else {
      setShowSearchPrompt(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSearching || addingKey) return;

    setError(null);
    setSearchResults(null);
    setShowSearchPrompt(false);

    const trimmedSearchTerm = searchTerm.trim();

    if (!trimmedSearchTerm) return;

    setIsSearching(true);

    try {
      const users = await searchUser(trimmedSearchTerm);

      if (users.length > 0) {
        setSearchResults(
          users.map((u) => ({
            uid: u.uid,
            username: u.username || "",
            email: u.email || "",
          })),
        );
      } else {
        setSearchResults(null);
      }
    } catch {
      setError("An error occurred while searching");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (result: SearchResult) => {
    if (!result.username || addingKey) return;
    const key = result.uid || result.username;

    try {
      setAddingKey(key);
      await addFriend(result.username, result.uid);
      setToast({ message: "Friend request sent!", type: "success" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add friend";
      setToast({ message: errorMessage, type: "error" });
    } finally {
      setAddingKey(null);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchResults(null);
    setError(null);
  };

  const showInviteFallback =
    searchResults === null &&
    !isSearching &&
    searchTerm.trim() &&
    isValidEmail(searchTerm.trim());

  return (
    <div className="flex flex-col h-full bg-white">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="flex items-center gap-2 p-4 border-b">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold outfit-semibold">
          Add New Friend
        </h2>
      </div>

      <div className="p-4 flex-1">
        <form onSubmit={handleSearch}>
          <div className="flex items-center px-4 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#6C5CE7]">
            <MagnifyingGlass className="w-5 h-5 mr-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchInputChange}
              autoFocus
              placeholder="Enter email/username to find friends or send invites"
              className="w-full bg-white py-4 outfit-normal focus:outline-none placeholder:text-gray-400"
              disabled={isSearching || !!addingKey}
            />
          </div>
        </form>

        {showSearchPrompt && !isSearching && (
          <div className="flex items-center mt-3">
            <ArrowElbowDownLeft className="w-3 h-3 mr-3 text-gray-500" />
            <p className="text-xs text-gray-500 outfit-normal">
              Press enter to search
            </p>
          </div>
        )}

        {isSearching ? (
          <div className="mt-8">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {searchResults && searchResults.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-[#45A134] outfit-normal font-medium">
                  {searchResults.length} result{searchResults.length > 1 ? "s" : ""}
                </p>
                {searchResults.map((result) => {
                  const key = result.uid || result.username || result.email;
                  const isThisAdding = addingKey === key;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium outfit-medium text-sm">
                          {result.email || result.username}
                        </p>
                        {result.username && (
                          <p className="text-sm outfit-normal text-gray-500">
                            @{result.username}
                          </p>
                        )}
                      </div>
                      <CustomButton
                        onClick={() => handleAddFriend(result)}
                        disabled={!!addingKey}
                        variant="primary"
                        size="sm"
                        showArrow={false}
                        trailingIcon={<UserPlus className="w-4 h-4" />}
                      >
                        {isThisAdding ? "Adding..." : "Add Friend"}
                      </CustomButton>
                    </div>
                  );
                })}
              </div>
            )}

            {searchResults !== null && searchResults.length === 0 && !showInviteFallback && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="outfit-medium text-sm">
                  No users found matching "{searchTerm.trim()}"
                </p>
              </div>
            )}

            {showInviteFallback && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 outfit-normal mb-1">
                  Looks like they haven't joined yet
                </p>
                <p className="font-medium outfit-medium text-base">
                  {searchTerm.trim()}
                </p>
                <CustomButton
                  onClick={() => {
                    setToast({ message: "Invitation sent successfully!", type: "success" });
                    setSearchTerm("");
                    setSearchResults(null);
                  }}
                  disabled={!!addingKey}
                  variant="dark"
                  fullWidth
                  className="mt-4"
                  showArrow={false}
                  trailingIcon={<PaperPlaneTilt className="w-5 h-5" />}
                >
                  Send an Invite Mail
                </CustomButton>
              </div>
            )}

            {error && <p className="mt-4 text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default AddFriend;
