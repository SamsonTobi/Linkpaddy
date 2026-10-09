import { signIn, handleSignOut, deleteUser, searchUserInternal, updateSettingsInternal, updateUsernameInternal, completeOnboardingInternal } from "./auth";
import type { AccountPlatform } from "./auth";
import { addFriend, acceptFriendInternal, rejectFriendInternal, removeFriendInternal } from "./friends";
import { checkForNewLinks } from "./sync";
import { refreshFriendProfiles } from "./friendsSync";
import { deleteContent, deleteReceivedContent, editText, handleUpdateLinkStatusMessage, shareLink, shareContent, handleToggleContentMessage } from "./links";

/**
 * Routes UI requests to the Firebase-backed data layer. Shared by the
 * extension's service worker and the web app, which differ only in the
 * `platform` they sign in with. Returns true when the response is sent
 * asynchronously.
 */
export function handleMessage(
  message: any,
  sendResponse: (response?: any) => void,
  platform: AccountPlatform,
): boolean {
  if (message.type === "SIGN_IN") {
    void signIn(platform);
  } else if (message.type === "SIGN_OUT") {
    handleSignOut();
  } else if (message.type === "DELETE_ACCOUNT") {
    deleteUser(message.uid, platform);
  } else if (message.type === "ADD_FRIEND") {
    addFriend(message.currentUser, message.friendUsername, message.friendUid)
      .then((result) =>
        sendResponse({ success: true, newFriend: result.newFriend }),
      )
      .catch((error) =>
        sendResponse({ success: false, error: error.message }),
      );
    return true; // Indicates that the response is sent asynchronously
  } else if (message.type === "ACCEPT_FRIEND") {
    acceptFriendInternal(message.currentUser, message.friendUsername)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "REJECT_FRIEND") {
    rejectFriendInternal(message.currentUser, message.friendUsername)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "SHARE_LINK") {
    shareLink(message.link, message.selectedFriends)
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({ success: false, error: error.message }),
      );
    return true;
  } else if (message.type === "SHARE_CONTENT") {
    shareContent({ link: message.link, text: message.text, contentType: message.contentType }, message.selectedFriends)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "TOGGLE_LIKE" || message.type === "TOGGLE_BOOKMARK") {
    handleToggleContentMessage(message, sendResponse);
    return true;
  } else if (message.type === "EDIT_TEXT") {
    editText(message.linkId, message.text).then(() => sendResponse({ success: true })).catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "DELETE_CONTENT") {
    deleteContent(message.linkId).then(() => sendResponse({ success: true })).catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "DELETE_RECEIVED_CONTENT") {
    deleteReceivedContent(message.linkId).then(() => sendResponse({ success: true })).catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "REFRESH_DATA") {
    checkForNewLinks()
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({ success: false, error: error.message }),
      );
    return true;
  } else if (message.type === "UPDATE_LINK_STATUS") {
    handleUpdateLinkStatusMessage(message, sendResponse);
    return true;
  } else if (message.type === "SEARCH_USER") {
    searchUserInternal(message.searchTerm)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "REMOVE_FRIEND") {
    removeFriendInternal(message.currentUser, message.friendUsername)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "UPDATE_SETTINGS") {
    updateSettingsInternal(message.uid, message.settings)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "UPDATE_USERNAME") {
    updateUsernameInternal(message.uid, message.nextUsername)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "COMPLETE_ONBOARDING") {
    completeOnboardingInternal(message.uid)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "REFRESH_FRIEND_PROFILES") {
    refreshFriendProfiles(message.uid)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
}
