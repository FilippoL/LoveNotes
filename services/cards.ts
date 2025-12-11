import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { db } from './firebase';
import { encryptionService } from './encryption';
import type { Card, CardType, CardTemplate } from '../types';

const CARDS_COLLECTION = 'cards';
const DRAW_HISTORY_COLLECTION = 'drawHistory';
const COOLDOWN_MINUTES = 15;
const MAX_TEXT_LENGTH = 200;
const MAX_VOICE_SECONDS = 60;

/**
 * Card Templates
 */
export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'admire',
    text: 'What I admire about you today is...',
    description: 'Share something you admire',
  },
  {
    id: 'loved',
    text: 'I felt loved when...',
    description: 'A moment that made you feel loved',
  },
  {
    id: 'beautiful',
    text: 'Something beautiful I see in you...',
    description: 'Something beautiful you noticed',
  },
  {
    id: 'grateful',
    text: 'I am grateful for...',
    description: 'Express your gratitude',
  },
  {
    id: 'appreciate',
    text: 'A small thing you did that mattered...',
    description: 'A small gesture that meant a lot',
  },
];

/**
 * Card Service
 * Handles card creation, drawing, rotation, and deck management
 */
class CardService {
  /**
   * Create a text card
   */
  async createTextCard(
    pairId: string,
    creatorId: string,
    content: string,
    templateId?: string,
    sharedSecret: Uint8Array
  ): Promise<string> {
    if (content.length > MAX_TEXT_LENGTH) {
      throw new Error(`Text must be ${MAX_TEXT_LENGTH} characters or less`);
    }

    // Encrypt content
    const encryptedContent = await encryptionService.encryptText(content, sharedSecret);

    const cardData: Omit<Card, 'id'> = {
      pairId,
      creatorId,
      encryptedContent,
      contentType: 'text',
      isRead: false,
      createdAt: new Date(),
      templateUsed: templateId,
    };

    const cardRef = doc(collection(db, CARDS_COLLECTION));
    await setDoc(cardRef, {
      ...cardData,
      createdAt: serverTimestamp(),
    });

    return cardRef.id;
  }

  /**
   * Create a voice card
   */
  async createVoiceCard(
    pairId: string,
    creatorId: string,
    audioUri: string,
    sharedSecret: Uint8Array
  ): Promise<string> {
    if (!audioUri) {
      throw new Error('Audio URI is required');
    }

    try {
      // Read audio file as base64 using expo-file-system legacy API
      // The new File API doesn't have readAsStringAsync, so we use the legacy API
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      if (!base64Audio) {
        throw new Error('Audio file is empty or could not be read');
      }

      // Convert base64 to Uint8Array for encryption
      // Pass Uint8Array directly - no ArrayBuffer conversion needed
      const audioBytes = decodeBase64(base64Audio);

      // Encrypt audio (now accepts Uint8Array directly)
      const { encryptedData, nonce } = await encryptionService.encryptVoiceFile(
        audioBytes,
        sharedSecret
      );

      // Combine nonce + encrypted data for storage
      const combined = new Uint8Array(nonce.length + encryptedData.length);
      combined.set(nonce);
      combined.set(encryptedData, nonce.length);

      // Store encrypted voice data directly in Firestore as base64 string
      // This avoids Firebase Storage Blob issues in React Native
      // Firestore 1MB limit should be sufficient for encrypted 60-second voice files
      const encryptedContentBase64 = encodeBase64(combined);

      // Create card document
      const cardData: Omit<Card, 'id'> = {
        pairId,
        creatorId,
        encryptedContent: encryptedContentBase64, // Store encrypted voice data here
        contentType: 'voice',
        isRead: false,
        createdAt: new Date(),
      };

      const cardRef = doc(collection(db, CARDS_COLLECTION));
      await setDoc(cardRef, {
        ...cardData,
        createdAt: serverTimestamp(),
      });

      return cardRef.id;
    } catch (error: any) {
      throw new Error(`Failed to create voice card: ${error.message}`);
    }
  }

  /**
   * Get unread cards for a pair
   */
  async getUnreadCards(pairId: string): Promise<Card[]> {
    const q = query(
      collection(db, CARDS_COLLECTION),
      where('pairId', '==', pairId),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Card[];
  }

  /**
   * Get all cards for a pair
   */
  async getAllCards(pairId: string): Promise<Card[]> {
    const q = query(
      collection(db, CARDS_COLLECTION),
      where('pairId', '==', pairId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Card[];
  }

  /**
   * Draw a random card from unread deck
   */
  async drawRandomCard(
    pairId: string,
    viewerId: string,
    sharedSecret: Uint8Array
  ): Promise<Card | null> {
    // Check cooldown
    const canDraw = await this.checkCooldown(pairId, viewerId);
    if (!canDraw.allowed) {
      throw new Error(`Please wait ${canDraw.remainingMinutes} minutes before drawing again`);
    }

    // Get unread cards
    const unreadCards = await this.getUnreadCards(pairId);

    if (unreadCards.length === 0) {
      // No unread cards - check if we need to reset deck
      const allCards = await this.getAllCards(pairId);
      if (allCards.length === 0) {
        return null; // No cards at all
      }

      // Reset all cards to unread
      await this.resetDeck(pairId);
      const resetUnreadCards = await this.getUnreadCards(pairId);
      if (resetUnreadCards.length === 0) {
        return null;
      }

      // Draw from reset deck
      return this.selectAndMarkCard(resetUnreadCards, pairId, viewerId, sharedSecret);
    }

    // Draw from unread cards
    return this.selectAndMarkCard(unreadCards, pairId, viewerId, sharedSecret);
  }

  /**
   * Select a random card and mark it as read
   */
  private async selectAndMarkCard(
    cards: Card[],
    pairId: string,
    viewerId: string,
    sharedSecret: Uint8Array
  ): Promise<Card> {
    // Select random card
    const randomIndex = Math.floor(Math.random() * cards.length);
    const selectedCard = cards[randomIndex];

    // Mark as read
    await updateDoc(doc(db, CARDS_COLLECTION, selectedCard.id), {
      isRead: true,
    });

    // Record draw history
    await this.recordDraw(pairId, selectedCard.id, viewerId);

    return {
      ...selectedCard,
      isRead: true,
    };
  }

  /**
   * Reset all cards in deck to unread
   */
  async resetDeck(pairId: string): Promise<void> {
    const allCards = await this.getAllCards(pairId);
    const batch = allCards.map((card) =>
      updateDoc(doc(db, CARDS_COLLECTION, card.id), {
        isRead: false,
      })
    );

    await Promise.all(batch);
  }

  /**
   * Check cooldown before drawing
   */
  async checkCooldown(pairId: string, userId: string): Promise<{
    allowed: boolean;
    remainingMinutes: number;
  }> {
    // Reference the subcollection: drawHistory/{pairId}/draws
    const pairDocRef = doc(db, DRAW_HISTORY_COLLECTION, pairId);
    const drawsRef = collection(pairDocRef, 'draws');
    const q = query(
      drawsRef,
      where('viewedBy', '==', userId),
      orderBy('drawnAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return { allowed: true, remainingMinutes: 0 };
    }

    const lastDraw = snapshot.docs[0].data();
    const lastDrawTime = lastDraw.drawnAt?.toDate() || new Date(0);
    const now = new Date();
    const minutesSinceLastDraw = (now.getTime() - lastDrawTime.getTime()) / (1000 * 60);

    if (minutesSinceLastDraw >= COOLDOWN_MINUTES) {
      return { allowed: true, remainingMinutes: 0 };
    }

    const remainingMinutes = Math.ceil(COOLDOWN_MINUTES - minutesSinceLastDraw);
    return { allowed: false, remainingMinutes };
  }

  /**
   * Record a draw in history
   */
  private async recordDraw(pairId: string, cardId: string, viewedBy: string): Promise<void> {
    // Reference the subcollection: drawHistory/{pairId}/draws/{drawId}
    const pairDocRef = doc(db, DRAW_HISTORY_COLLECTION, pairId);
    const drawsRef = collection(pairDocRef, 'draws');
    const historyRef = doc(drawsRef);
    await setDoc(historyRef, {
      cardId,
      viewedBy,
      drawnAt: serverTimestamp(),
    });
  }

  /**
   * Get recent draw history
   */
  async getRecentDraws(pairId: string, limitCount: number = 5): Promise<any[]> {
    // Reference the subcollection: drawHistory/{pairId}/draws/{drawId}
    // First get the pair document, then its draws subcollection
    const pairDocRef = doc(db, DRAW_HISTORY_COLLECTION, pairId);
    const drawsRef = collection(pairDocRef, 'draws');
    const q = query(
      drawsRef,
      orderBy('drawnAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      drawnAt: doc.data().drawnAt?.toDate() || new Date(),
    }));
  }

  /**
   * Decrypt card content
   */
  async decryptCard(card: Card, sharedSecret: Uint8Array): Promise<string> {
    if (card.contentType === 'text') {
      return await encryptionService.decryptText(card.encryptedContent, sharedSecret);
    }
    throw new Error('Voice cards are decrypted during playback');
  }

  /**
   * Get card by ID
   */
  async getCard(cardId: string): Promise<Card | null> {
    const cardDoc = await getDoc(doc(db, CARDS_COLLECTION, cardId));
    if (!cardDoc.exists()) {
      return null;
    }

    return {
      id: cardDoc.id,
      ...cardDoc.data(),
      createdAt: cardDoc.data().createdAt?.toDate() || new Date(),
    } as Card;
  }
}

// Export singleton instance
export const cardService = new CardService();
export default cardService;

