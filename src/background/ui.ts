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
