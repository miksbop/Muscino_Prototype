export type FriendUser = {
  id: number;
  username: string;
  displayName: string;
  wallet: number;
  avatarUrl: string | null;
  bio: string;
};

export type FriendRequest = {
  id: number;
  status: "pending" | "accepted" | "denied";
  fromUser: FriendUser;
  toUser: FriendUser;
  createdAt: string;
};

export type FriendsOverview = {
  friends: FriendUser[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
};