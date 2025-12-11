import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { encryptionService } from './encryption';
import type { User, Pair, ConnectionStatus, InviteCode } from '../types';

const INVITE_CODES_COLLECTION = 'inviteCodes';
const PAIRS_COLLECTION = 'pairs';

/**
 * Partner Connection Service
 * Handles partner pairing, invite codes, and connection management
 */
class PartnerService {
  /**
   * Generate an invite code for the current user
   */
  async generateInviteCode(userId: string, publicKey: string): Promise<string> {
    if (!publicKey) {
      throw new Error('Public key is required to generate invite code');
    }

    try {
      const code = encryptionService.generateInviteCode();

      const inviteData: InviteCode = {
        code,
        publicKey,
        userId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      // Store invite code in Firestore
      await setDoc(doc(db, INVITE_CODES_COLLECTION, code), {
        ...inviteData,
        createdAt: serverTimestamp(),
        expiresAt: new Date(inviteData.expiresAt!.getTime()),
      });

      return code;
    } catch (error: any) {
      console.error('Error generating invite code in service:', error);
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied. Please check your Firebase security rules.');
      }
      throw new Error(`Failed to generate invite code: ${error.message}`);
    }
  }

  /**
   * Accept an invite code and create a pair
   */
  async acceptInviteCode(
    inviteCode: string,
    currentUser: User
  ): Promise<{ pairId: string; partnerPublicKey: string }> {
    // Get invite code from Firestore
    const inviteDoc = await getDoc(doc(db, INVITE_CODES_COLLECTION, inviteCode));
    if (!inviteDoc.exists()) {
      throw new Error('Invalid invite code');
    }

    const inviteData = inviteDoc.data() as InviteCode & { createdAt: any; expiresAt: any };

    // Check expiration
    const expiresAt = inviteData.expiresAt?.toDate();
    if (expiresAt && expiresAt < new Date()) {
      throw new Error('Invite code has expired');
    }

    // Prevent self-pairing
    if (inviteData.userId === currentUser.id) {
      throw new Error('Cannot pair with yourself');
    }

    // Create pair (sort IDs to ensure consistent pairId regardless of who creates it)
    const userIds = [inviteData.userId, currentUser.id].sort();
    const pairId = `${userIds[0]}_${userIds[1]}`;

    // Check if current user is already paired with someone else (not the inviter)
    if (currentUser.partnerId && currentUser.partnerId !== pairId) {
      throw new Error('You are already paired with a partner');
    }

    // Check if inviter is already paired
    const inviterDoc = await getDoc(doc(db, 'users', inviteData.userId));
    if (!inviterDoc.exists()) {
      throw new Error('Inviter user not found');
    }

    const inviterData = inviterDoc.data() as User;
    
    // Check if inviter is already paired with someone else (not the current user)
    if (inviterData.partnerId && inviterData.partnerId !== pairId) {
      throw new Error('This user is already paired with someone else');
    }

    // Check if pair already exists (idempotent operation)
    const existingPairDoc = await getDoc(doc(db, PAIRS_COLLECTION, pairId));
    if (existingPairDoc.exists()) {
      // Pair already exists, just ensure both users are updated
      const existingPairData = existingPairDoc.data() as Pair;
      if (
        (existingPairData.user1Id === inviteData.userId || existingPairData.user2Id === inviteData.userId) &&
        (existingPairData.user1Id === currentUser.id || existingPairData.user2Id === currentUser.id)
      ) {
        // Pair is valid, just update user documents if needed
        if (inviterData.partnerId !== pairId) {
          await updateDoc(doc(db, 'users', inviteData.userId), {
            partnerId: pairId,
            connectionStatus: 'connected',
          });
        }
        if (currentUser.partnerId !== pairId) {
          await updateDoc(doc(db, 'users', currentUser.id), {
            partnerId: pairId,
            connectionStatus: 'connected',
          });
        }
        // Delete used invite code
        await deleteDoc(doc(db, INVITE_CODES_COLLECTION, inviteCode));
        return {
          pairId,
          partnerPublicKey: inviteData.publicKey,
        };
      } else {
        throw new Error('Invalid pair configuration');
      }
    }

    // Create new pair
    const pairData: Pair = {
      id: pairId,
      user1Id: userIds[0],
      user2Id: userIds[1],
      createdAt: new Date(),
    };

    await setDoc(doc(db, PAIRS_COLLECTION, pairId), {
      ...pairData,
      createdAt: serverTimestamp(),
    });

    // Update both users' partnerId and connectionStatus
    await updateDoc(doc(db, 'users', inviteData.userId), {
      partnerId: pairId,
      connectionStatus: 'connected',
    });

    await updateDoc(doc(db, 'users', currentUser.id), {
      partnerId: pairId,
      connectionStatus: 'connected',
    });

    // Delete used invite code
    await deleteDoc(doc(db, INVITE_CODES_COLLECTION, inviteCode));

    return {
      pairId,
      partnerPublicKey: inviteData.publicKey,
    };
  }

  /**
   * Get partner information
   */
  async getPartner(userId: string, pairId: string): Promise<User | null> {
    const pairDoc = await getDoc(doc(db, PAIRS_COLLECTION, pairId));
    if (!pairDoc.exists()) {
      return null;
    }

    const pairData = pairDoc.data() as Pair;
    const partnerId = pairData.user1Id === userId ? pairData.user2Id : pairData.user1Id;

    const partnerDoc = await getDoc(doc(db, 'users', partnerId));
    if (!partnerDoc.exists()) {
      return null;
    }

    const partnerData = partnerDoc.data() as Omit<User, 'id'>;
    return {
      id: partnerId,
      ...partnerData,
      createdAt: partnerData.createdAt?.toDate() || new Date(),
    };
  }

  /**
   * Get partner's public key
   */
  async getPartnerPublicKey(userId: string, pairId: string): Promise<string> {
    const partner = await this.getPartner(userId, pairId);
    if (!partner) {
      throw new Error('Partner not found');
    }
    return partner.publicKey;
  }

  /**
   * Break up (sever connection)
   */
  async breakup(userId: string, pairId: string): Promise<void> {
    const pairDoc = await getDoc(doc(db, PAIRS_COLLECTION, pairId));
    if (!pairDoc.exists()) {
      throw new Error('Pair not found');
    }

    const pairData = pairDoc.data() as Pair;
    if (pairData.user1Id !== userId && pairData.user2Id !== userId) {
      throw new Error('You are not part of this pair');
    }

    // Update both users' connection status
    await updateDoc(doc(db, 'users', pairData.user1Id), {
      partnerId: null,
      connectionStatus: 'broken',
    });

    await updateDoc(doc(db, 'users', pairData.user2Id), {
      partnerId: null,
      connectionStatus: 'broken',
    });

    // Delete the pair document
    await deleteDoc(doc(db, PAIRS_COLLECTION, pairId));

    // Clear shared secret cache
    encryptionService.clearSharedSecret(pairId);
  }

  /**
   * Check if user has pending invite code
   */
  async hasPendingInvite(userId: string): Promise<boolean> {
    const q = query(
      collection(db, INVITE_CODES_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Get user's active invite code
   */
  async getActiveInviteCode(userId: string): Promise<string | null> {
    const q = query(
      collection(db, INVITE_CODES_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    // Return the most recent invite code
    const invites = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by createdAt (most recent first)
    invites.sort((a, b) => {
      const aTime = a.createdAt?.toDate()?.getTime() || 0;
      const bTime = b.createdAt?.toDate()?.getTime() || 0;
      return bTime - aTime;
    });

    return invites[0].code || null;
  }

  /**
   * Revoke invite code
   */
  async revokeInviteCode(inviteCode: string): Promise<void> {
    await deleteDoc(doc(db, INVITE_CODES_COLLECTION, inviteCode));
  }
}

// Export singleton instance
export const partnerService = new PartnerService();
export default partnerService;

