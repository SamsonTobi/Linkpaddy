import React, { useEffect, useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import LandingPage from "./components/LandingPage";
import { useAuth } from "./contexts/AuthContext";
import { Loader } from "lucide-react";
import Onboarding from "./components/Onboarding";
import ShareLink from "./components/ShareLink";

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col gap-3 items-center justify-center h-full bg-white">
    <Loader className="w-12 h-12 text-gray-300 animate-spin" />
    <p className="font-medium outfit-medium">Please hold on...</p>
  </div>
);

const AppContent: React.FC = () => {
  const { currentUser, isLoading, isNewUser } = useAuth();
  const [showContent, setShowContent] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Check if we run as a webpage or extension
  const isWebPage =
    typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id;

  useEffect(() => {
    if (isWebPage) {
      setShowContent(true);
      return;
    }

    // Connect to background script to enable live refresh while popup is open
    const port = chrome.runtime.connect({ name: "popup" });

    // Message listener setup
    chrome.storage.local.get(["shareUrl"], (result) => {
      if (result.shareUrl) {
        setShareUrl(result.shareUrl);
        // Clear the stored URL after retrieving it
        chrome.storage.local.remove("shareUrl");
      }
    });

    // Timer setup for content display
    let timer: NodeJS.Timeout | undefined;
    if (!isLoading && currentUser !== undefined && isNewUser !== undefined) {
      timer = setTimeout(() => {
        setShowContent(true);
      }, 200);
    }

    // Cleanup function
    return () => {
      if (timer) clearTimeout(timer);
      port.disconnect();
    };
  }, [isLoading, currentUser, isNewUser]); // Include all dependencies

  // Show loading spinner while either loading or waiting for timer
  if (
    isLoading ||
    currentUser === undefined ||
    isNewUser === undefined ||
    !showContent
  ) {
    return <LoadingSpinner />;
  }

  // After loading and timer, show appropriate content
  if (!currentUser) {
    return <Login />;
  }

  if (isNewUser) {
    return <Onboarding />;
  }

  if (shareUrl) {
    return (
      <ShareLink
        onBack={() => setShareUrl(null)}
        initialLink={shareUrl}
        skipToFriends={true}
      />
    );
  }

  return <Dashboard />;
};

const App: React.FC = () => {
  const isWebPage =
    typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id;

  if (isWebPage) {
    return (
      <AuthProvider>
        <LandingPage />
      </AuthProvider>
    );
  }

  return (
    <div style={{ width: "450px", height: "550px" }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </div>
  );
};

export default App;
