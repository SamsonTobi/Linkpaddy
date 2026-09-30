export function openExtensionUi() {
  const extensionUrl = chrome.runtime.getURL("index.html");

  chrome.action.openPopup(() => {
    if (!chrome.runtime.lastError) {
      return;
    }

    chrome.tabs.query({ url: extensionUrl }, (tabs) => {
      if (tabs.length > 0) {
        const existingTab = tabs[0];
        if (existingTab.id !== undefined) {
          chrome.tabs.update(existingTab.id, { active: true });
        }
        if (existingTab.windowId !== undefined) {
          chrome.windows.update(existingTab.windowId, { focused: true });
        }
        return;
      }

      chrome.tabs.create({ url: extensionUrl });
    });
  });
}

type SidePanelApi = {
  open: (options: { windowId: number }) => Promise<void> | void;
  setPanelBehavior?: (behavior: {
    openPanelOnActionClick?: boolean;
  }) => Promise<void> | void;
};

function getSidePanelApi(): SidePanelApi | null {
  const api = (chrome as unknown as { sidePanel?: SidePanelApi }).sidePanel;
  return api ?? null;
}

async function resolveWindowId(fallback?: number): Promise<number | null> {
  if (typeof fallback === "number") {
    return fallback;
  }
  // Prefer the active tab's window: when the request comes from the popup
  // (via runtime message) getCurrent() can return the popup itself, whose
  // window id sidePanel.open() rejects. The active tab always lives in a
  // normal browser window, which is what the panel must attach to.
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const windowId = tabs?.[0]?.windowId;
    if (typeof windowId === "number") {
      return windowId;
    }
  } catch {
    // Fall through to window lookups.
  }
  try {
    const lastFocused = await chrome.windows.getLastFocused();
    if (typeof lastFocused.id === "number") {
      return lastFocused.id;
    }
  } catch {
    // Fall through to current-window lookup.
  }
  try {
    const current = await chrome.windows.getCurrent();
    if (typeof current.id === "number") {
      return current.id;
    }
  } catch {
    return null;
  }
  return null;
}

// Opens the native browser side panel (Chrome/Edge/Brave 114+).
// Returns true when the side panel opened, false when unavailable
// so callers can fall back to the popup.
export async function openSidePanel(windowId?: number): Promise<boolean> {
  const sidePanel = getSidePanelApi();
  if (!sidePanel) {
    return false;
  }
  const targetWindowId = await resolveWindowId(windowId);
  if (targetWindowId === null) {
    return false;
  }
  try {
    await sidePanel.open({ windowId: targetWindowId });
    return true;
  } catch (error) {
    console.warn("Side panel open failed, falling back to popup:", error);
    return false;
  }
}

// Keep the toolbar popup as the default action; the side panel is
// opt-in via context menu / in-app toggle so both surfaces coexist.
export async function keepPopupOnActionClick(): Promise<void> {
  const sidePanel = getSidePanelApi();
  if (!sidePanel?.setPanelBehavior) {
    return;
  }
  try {
    await sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch (error) {
    console.warn("Could not set side panel behavior:", error);
  }
}
