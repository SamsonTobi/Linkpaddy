/** `chrome.runtime.id` of the web app's chrome shim; real extensions get a generated id. */
export const WEB_RUNTIME_ID = "linkpaddy-web";

/** True when the UI runs as the installable web app rather than the extension. */
export const isWebApp = (): boolean =>
  typeof chrome !== "undefined" && chrome.runtime?.id === WEB_RUNTIME_ID;
