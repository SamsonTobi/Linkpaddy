import { auth } from "../firebase";

const AUTH_READY_TIMEOUT_MS = 3000;

export class BackgroundAuthNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackgroundAuthNotReadyError";
  }
}

export async function waitForAuthReadyWithTimeout() {
  if (typeof (auth as any).authStateReady !== "function") {
    return;
  }

  try {
    await Promise.race([
      (auth as any).authStateReady(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, AUTH_READY_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn("Auth readiness check failed:", error);
  }
}

export async function requireMatchingAuthUser(expectedUid?: string) {
  await waitForAuthReadyWithTimeout();

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new BackgroundAuthNotReadyError(
      "Firebase auth is not ready. Please reopen the extension or sign in again.",
    );
  }

  if (expectedUid && currentUser.uid !== expectedUid) {
    throw new BackgroundAuthNotReadyError(
      "Firebase auth user does not match the stored user. Please sign in again.",
    );
  }

  return currentUser;
}
