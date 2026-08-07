import React, { useEffect, useState } from "react";
import { Bell, Check, PushPin, PuzzlePiece } from "@phosphor-icons/react";
import CustomButton from "./ui/CustomButton";

interface PinExtensionProps {
  onComplete: () => void;
  isCompleting?: boolean;
}

const PinExtension: React.FC<PinExtensionProps> = ({ onComplete, isCompleting }) => {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const settings = await chrome.action.getUserSettings();
        setIsPinned(settings.isOnToolbar);
      } catch {
        setIsPinned(false);
      }
    };
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  return (
    <div className="flex h-full flex-col bg-white p-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-6 flex h-24 w-48 items-center justify-center rounded-2xl bg-[#F5F3FF]">
          <PuzzlePiece className="h-11 w-11 text-[#6C5CE7]" />
          <div className="absolute right-8 top-4 rounded-full bg-white p-2 shadow-md"><PushPin className="h-5 w-5 text-[#6C5CE7]" weight="fill" /></div>
          <div className="absolute bottom-3 left-8 rounded-full bg-white p-2 shadow-md"><Bell className="h-4 w-4 text-[#6C5CE7]" weight="fill" /></div>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6C5CE7]">One last step</p>
        <h1 className="text-2xl font-bold">Keep LinkPaddy close</h1>
        <p className="mt-3 max-w-sm text-sm text-gray-600">Open Chrome's Extensions menu and pin LinkPaddy. Pinning keeps the unread badge visible and makes sharing faster.</p>
        <div className="mt-6 w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-left text-sm">
          <p className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white font-semibold text-[#6C5CE7]">1</span> Select the puzzle icon in the toolbar</p>
          <p className="mt-3 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white font-semibold text-[#6C5CE7]">2</span> Select the pin beside LinkPaddy</p>
        </div>
      </div>
      <CustomButton onClick={onComplete} disabled={isCompleting} variant="primary" fullWidth showArrow={false} trailingIcon={isPinned ? <Check className="h-4 w-4" /> : <PushPin className="h-4 w-4" />}>{isCompleting ? "Finishing..." : isPinned ? "Pinned - finish setup" : "Continue"}</CustomButton>
      <p className="mt-2 text-center text-xs text-gray-400">You can continue without pinning. Notifications follow your browser and system settings.</p>
    </div>
  );
};

export default PinExtension;
