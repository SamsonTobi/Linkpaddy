export type SharedLink = {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  recipients: string[];
  status: string;
  kind?: "link" | "friend_added";
};

export type Friend = {
  uid?: string;
  username?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  addedAt?: string;
};
