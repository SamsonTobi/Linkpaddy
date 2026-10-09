import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { AppContent } from "./App";
import { prepareWebRuntime, startWebRuntime } from "./web/runtime";
import "./index.css";
import "./web/web.css";

// The UI reads chrome.* while rendering, so the shim goes in before mounting.
prepareWebRuntime();

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <div className="web-shell">
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </div>
    </React.StrictMode>,
  );
  startWebRuntime();
} else {
  console.error("Root element not found");
}
