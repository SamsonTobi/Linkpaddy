import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { halftoneWelcomeImg } from "../assets/image";
import CustomButton from "./ui/CustomButton";

const Login: React.FC = () => {
  const { currentUser, signIn, isLoading, error } = useAuth();

  if (currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#6C5CE7] text-white overflow-hidden">
      <div className="relative h-1/2 w-full overflow-hidden">
        <img
          src={halftoneWelcomeImg}
          alt="Friends sharing links"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="relative z-10 -mt-10 flex flex-1 flex-col px-7 pb-7">
        <h1 className="text-4xl inline-block leading-[1.02] font-bold outfit-semibold tracking-tighter">
          The easiest way to share links {" "}
          <span className="inline-block text-[#2F278D]">with your inner circle</span>
        </h1>

        <p className="mt-5 text-sm outfit-normal leading-relaxed text-white/50">
          Send interesting finds to your people, right from your browser in one
          tap.
        </p>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50/95 px-3 py-2 text-sm text-red-600 outfit-normal">
            {error}
          </div>
        )}

        <div className="mt-auto pt-6">
          <CustomButton
            onClick={signIn}
            disabled={isLoading}
            variant="onPrimary"
            size="lg"
            fullWidth
            className="font-semibold rounded-lg"
          >
            {isLoading ? "Signing in..." : "Continue with Google or Email"}
          </CustomButton>
        </div>
      </div>
    </div>
  );
};

export default Login;
