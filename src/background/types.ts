export type SharedLink = {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  recipients: string[];
  status: string;
  kind?: "link" | "friend_added" | "friend_request_received" | "friend_request_accepted" | "friend_request_rejected" | "friend_removed" | "auto_friend_added";
  senderProfile?: {
    uid: string;
    displayName: string;
    photoURL: string;
    email: string;
  };
};

export type Friend = {
  uid?: string;
  username?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  addedAt?: string;
  status?: "accepted" | "request_sent" | "request_received" | "auto";
};
