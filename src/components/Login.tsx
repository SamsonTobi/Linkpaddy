import React from "react";
import { useAuth } from "../contexts/AuthContext";
import linkshareIllus from "../assets/linkshareIllus.png"; // Adjust the path as necessary


const Login: React.FC = () => {
  const { currentUser, signIn, isLoading, error } = useAuth();

  if (currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      {/* Main content container */}
      <div className="w-full max-w-md space-y-8 text-center flex flex-col items-center">
        {/* Title section */}
        <div className="space-y-3 flex flex-col items-center">
          <h1 className="text-xl font-bold outfit-bold text-gray-900 w-4/5">
            The easiest way to share links with your inner circle
          </h1>
          <p className="text-sm outfit-normal text-gray-500">
            Send interesting finds to friends, right from your browser
          </p>
        </div>

        {/* Placeholder image */}
        <div className="rounded-2xl aspect-video w-[90%] flex items-center justify-center">
          <img
            src={linkshareIllus}
            alt="Link sharing illustration"
            className="w-full"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="text-red-500 bg-red-50 p-3 rounded-lg outfit-normal">{error}</div>
        )}

        {/* Sign in button */}
        <button
          onClick={signIn}
          disabled={isLoading}
          className="w-[85%] flex items-center justify-center gap-2 bg-[#6C5CE7] text-white text-sm py-3 px-6 rounded-full font-medium outfit-medium hover:bg-[#6051ce] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
            />
          </svg>
          {isLoading ? "Signing in..." : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
};

export default Login;
