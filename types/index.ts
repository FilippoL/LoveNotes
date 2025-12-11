// User Types
export interface User {
  id: string;
  email: string;
  displayName?: string;
  publicKey: string;
  partnerId: string | null;
  connectionStatus: ConnectionStatus;
  createdAt: Date;
}

export type ConnectionStatus = 'unpaired' | 'pending' | 'connected' | 'broken';

// Pair Types
export interface Pair {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: Date;
  sharedSecretKeyEncrypted?: string; // Encrypted shared secret
}

// Card Types
export type CardType = 'text' | 'voice';

export interface Card {
  id: string;
  pairId: string;
  creatorId: string;
  encryptedContent: string; // Encrypted text or voice file reference
  contentType: CardType;
  voiceUrl?: string; // Firebase Storage URL for voice files
  isRead: boolean;
  createdAt: Date;
  templateUsed?: string; // Optional template identifier
}

export interface CardTemplate {
  id: string;
  text: string;
  description?: string;
}

// Draw History Types
export interface DrawHistory {
  id: string;
  pairId: string;
  cardId: string;
  drawnAt: Date;
  viewedBy: string; // User ID who drew the card
}

// Invite Code Types
export interface InviteCode {
  code: string;
  publicKey: string;
  userId: string;
  createdAt: Date;
  expiresAt?: Date;
}

// Encryption Types
export interface KeyPair {
  publicKey: string; // Base64 encoded
  privateKey: string; // Base64 encoded, stored locally only
}

export interface SharedSecret {
  secret: Uint8Array; // Derived from ECDH, never stored
  pairId: string;
}

// Auth Types
export interface AuthUser {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
}

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Connect: undefined;
  Home: undefined;
  CreateCard: undefined;
  ViewCard: { cardId: string };
  Settings: undefined;
};

