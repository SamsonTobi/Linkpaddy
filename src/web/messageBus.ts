// A `chrome.runtime` look-alike for a single page. The UI and the data layer
// both live in this page, so one bus carries both directions: a message goes
// to every onMessage listener (the UI's broadcast handlers) and to the data
// layer's handler, which is what answers requests.

export type Sender = { id?: string };
export type SendResponse = (response?: unknown) => void;
export type MessageListener = (message: any, sender: Sender, sendResponse: SendResponse) => unknown;
/** Returns true when it will answer later through sendResponse. */
export type RequestHandler = (message: any, sendResponse: SendResponse) => boolean;

export function createRuntime(id: string, handleRequest: RequestHandler) {
  const listeners = new Set<MessageListener>();
  let lastError: { message: string } | undefined;
  const sender: Sender = { id };

  const invoke = (callback: (response?: unknown) => void, response?: unknown, error?: string) => {
    lastError = error ? { message: error } : undefined;
    try {
      callback(response);
    } finally {
      lastError = undefined;
    }
  };

  function sendMessage(message: unknown, callback?: (response?: unknown) => void): Promise<unknown> | undefined {
    const deliver = (done: (response?: unknown, error?: string) => void) => {
      let settled = false;
      const respond: SendResponse = (response) => {
        if (settled) return;
        settled = true;
        Promise.resolve().then(() => done(response));
      };
      for (const listener of Array.from(listeners)) {
        try {
          listener(message, sender, () => {});
        } catch (error) {
          console.error("onMessage listener failed:", error);
        }
      }
      const willRespondLater = handleRequest(message, respond);
      if (!willRespondLater && !settled) {
        settled = true;
        Promise.resolve().then(() => done(undefined, "The message port closed before a response was received."));
      }
    };

    if (callback) {
      deliver((response, error) => invoke(callback, response, error));
      return undefined;
    }
    return new Promise((resolve) => deliver((response) => resolve(response)));
  }

  return {
    id,
    get lastError() {
      return lastError;
    },
    sendMessage,
    onMessage: {
      addListener: (listener: MessageListener) => void listeners.add(listener),
      removeListener: (listener: MessageListener) => void listeners.delete(listener),
      hasListener: (listener: MessageListener) => listeners.has(listener),
    },
    /** The extension keeps the service worker polling while a popup port is open; the web runtime syncs on its own. */
    connect: (info?: { name?: string }) => ({
      name: info?.name ?? "",
      disconnect() {},
      postMessage() {},
      onDisconnect: { addListener() {}, removeListener() {} },
      onMessage: { addListener() {}, removeListener() {} },
    }),
  };
}
