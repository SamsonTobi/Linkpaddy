import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeft,
  Search,
  UserPlus,
  CornerDownLeft,
  Mail,
  Loader,
} from "lucide-react";

interface AddFriendProps {
  onBack: () => void;
}

interface SearchResult {
  username: string;
  email: string;
}

interface ToastProps {
  message: string;
  type: "success" | "error";
}

interface User {
  username?: string;
  email?: string | null;
}

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col gap-3 items-center justify-center h-full bg-white mt-7">
    <Loader className="w-10 h-10 text-gray-300 animate-spin" />
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
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSearchPrompt, setShowSearchPrompt] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    setError(null);
    setSearchResult(null);
    setShowSearchPrompt(false);

    const trimmedSearchTerm = searchTerm.trim();

    if (!trimmedSearchTerm) return;

    setIsLoading(true);

    try {
      const user = await new Promise<User>((resolve) => {
        setTimeout(async () => {
          const result = await searchUser(trimmedSearchTerm);
          resolve(result || { username: "", email: "" });
        }, 1500);
      });

      if (user) {
        setSearchResult({
          username: user.username || "",
          email: user.email || "",
        });
      } else {
        setSearchResult({
          username: "",
          email: trimmedSearchTerm,
        });
      }
    } catch (error) {
      setError("An error occurred while searching");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!searchResult) return;
    // setIsLoading(true);

    try {
      if (searchResult.username) {
        await addFriend(searchResult.username);
        setToast({ message: "Friend added successfully!", type: "success" });
        setTimeout(() => onBack(), 2000);
      } else {
        // Handle invitation
        setToast({ message: "Invitation sent successfully!", type: "success" });
        setSearchTerm("");
        setSearchResult(null);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add friend";
      setToast({ message: errorMessage, type: "error" });
    } finally {
      // setIsLoading(false);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchResult(null);
    setError(null);
  };

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
            <Search className="w-5 h-5 mr-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchInputChange}
              autoFocus
              placeholder="Enter email/username to find friends or send invites"
              className="w-full bg-white py-4 outfit-normal focus:outline-none placeholder:text-gray-400"
              disabled={isLoading}
            />
          </div>
        </form>

        {showSearchPrompt && !isLoading && (
          <div className="flex items-center mt-3">
            <CornerDownLeft className="w-3 h-3 mr-3 text-gray-500" />
            <p className="text-xs text-gray-500 outfit-normal">
              Press enter to search
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="mt-8">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {searchResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                {searchResult.username ? (
                  // Existing user card
                  <>
                    <p className="text-xs text-[#45A134] mb-2 outfit-normal">
                      ✓ Found
                    </p>
                    <p className="font-medium outfit-medium text-base">
                      {searchResult.email}
                    </p>
                    <p className="text-sm outfit-normal text-gray-600">
                      @{searchResult.username}
                    </p>
                    <button
                      onClick={handleAddFriend}
                      className="mt-4 w-full bg-[#6C5CE7] text-white font-medium outfit-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Friend
                    </button>
                  </>
                ) : // Invite card
                isValidEmail(searchResult.email) ? (
                  <>
                    <p className="text-xs text-gray-500 outfit-normal mb-1">
                      Looks like they haven't joined yet
                    </p>
                    <p className="font-medium outfit-medium text-base">
                      {searchResult.email}
                    </p>
                    <button
                      onClick={handleAddFriend}
                      className="mt-4 w-full bg-gray-800 text-white font-medium outfit-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Send an Invite Mail
                    </button>
                  </>
                ) : (
                  <>
                    <p className="outfit-medium text-base">
                      Oops! We couldn't find who you searched for...
                    </p>
                  </>
                )}
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
