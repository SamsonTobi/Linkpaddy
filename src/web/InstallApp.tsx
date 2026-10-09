import React from "react";
import { DownloadSimple, ShareNetwork } from "@phosphor-icons/react";
import { useInstallState } from "./install";

/** Settings row that puts LinkPaddy on the home screen; hidden once installed. */
const InstallApp: React.FC = () => {
  const state = useInstallState();
  if (state.kind === "installed" || state.kind === "unavailable") return null;

  return (
    <div className="flex items-center justify-between gap-4 mt-5 pt-5 border-t">
      <div>
        <p className="text-sm font-medium text-gray-800">Install LinkPaddy</p>
        {state.kind === "ios" ? (
          <p className="text-xs text-gray-500">
            Tap <ShareNetwork className="inline w-3.5 h-3.5 -mt-0.5" aria-label="Share" /> in Safari, then
            &ldquo;Add to Home Screen&rdquo;
          </p>
        ) : (
          <p className="text-xs text-gray-500">Open it from your home screen, and share to it from other apps</p>
        )}
      </div>
      {state.kind === "prompt" && (
        <button
          onClick={() => void state.install()}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#6C5CE7] px-4 py-2 text-sm font-semibold text-white"
        >
          <DownloadSimple className="w-4 h-4" />
          Install
        </button>
      )}
    </div>
  );
};

export default InstallApp;
