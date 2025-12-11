import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { encryptionService } from './encryption';
import type { User, ConnectionStatus } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STORAGE_KEY = '@lovenotes:user';

/**
 * Authentication Service
 * Handles user authentication and user data management
 */
class AuthService {
  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string, displayName?: string): Promise<User> {
    try {
      // Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update display name if provided
      if (displayName) {
        await updateProfile(firebaseUser, { displayName });
      }

      // Generate encryption keypair
      const keypair = await encryptionService.generateKeyPair();
      await encryptionService.storePrivateKey(keypair.privateKey);

      // Create user document in Firestore
      const userData: Omit<User, 'id'> = {
        email,
        displayName: displayName || undefined,
        publicKey: keypair.publicKey,
        partnerId: null,
        connectionStatus: 'unpaired',
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userData);

      const user: User = {
        id: firebaseUser.uid,
        ...userData,
      };

      // Cache user data locally
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      return user;
    } catch (error: any) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Sign in with email and password
   */
  async login(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Load user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        throw new Error('User data not found. Please contact support.');
      }

      const userData = userDoc.data() as Omit<User, 'id'>;
      const user: User = {
        id: firebaseUser.uid,
        ...userData,
        createdAt: userData.createdAt?.toDate() || new Date(),
      };

      // Verify private key exists locally
      const privateKey = await encryptionService.getPrivateKey();
      if (!privateKey) {
        throw new Error(
          'Private key not found. This may happen if you cleared app data. Please contact support.'
        );
      }

      // Cache user data locally
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      return user;
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Sign out current user
   */
  async logout(): Promise<void> {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      // Clear all shared secrets from cache
      encryptionService.clearSharedSecret(); // Clear all
    } catch (error: any) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(`Password reset failed: ${error.message}`);
    }
  }

  /**
   * Get current authenticated user from Firestore
   */
  async getCurrentUser(forceRefresh: boolean = false): Promise<User | null> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return null;
    }

    try {
      // If forceRefresh is true, skip cache and read from Firestore
      if (!forceRefresh) {
        // Try cache first
        const cachedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (cachedUser) {
          const user = JSON.parse(cachedUser) as User;
          // Verify Firebase user matches
          if (user.id === firebaseUser.uid) {
            return user;
          }
        }
      }

      // Load from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data() as Omit<User, 'id'>;
      const user: User = {
        id: firebaseUser.uid,
        ...userData,
        createdAt: userData.createdAt?.toDate() || new Date(),
      };

      // Update cache
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get cached user (for offline/initial load)
   */
  async getCachedUser(): Promise<User | null> {
    try {
      const cachedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (cachedUser) {
        return JSON.parse(cachedUser) as User;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;

