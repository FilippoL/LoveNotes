import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyPair, SharedSecret } from '../types';

const PRIVATE_KEY_STORAGE_KEY = '@lovenotes:privateKey';
const SHARED_SECRET_STORAGE_KEY_PREFIX = '@lovenotes:sharedSecret:';

/**
 * Encryption Service
 * Handles all encryption/decryption operations using TweetNaCl.js
 */
class EncryptionService {
  /**
   * Generate a new keypair for the user
   */
  async generateKeyPair(): Promise<KeyPair> {
    const keypair = nacl.box.keyPair();
    return {
      publicKey: encodeBase64(keypair.publicKey),
      privateKey: encodeBase64(keypair.secretKey),
    };
  }

  /**
   * Store private key securely in AsyncStorage
   */
  async storePrivateKey(privateKey: string): Promise<void> {
    await AsyncStorage.setItem(PRIVATE_KEY_STORAGE_KEY, privateKey);
  }

  /**
   * Retrieve private key from AsyncStorage
   */
  async getPrivateKey(): Promise<string | null> {
    return await AsyncStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
  }

  /**
   * Derive shared secret from partner's public key using ECDH
   */
  async deriveSharedSecret(partnerPublicKeyBase64: string): Promise<Uint8Array> {
    const privateKeyBase64 = await this.getPrivateKey();
    if (!privateKeyBase64) {
      throw new Error('Private key not found. Please generate a keypair first.');
    }

    const partnerPublicKey = decodeBase64(partnerPublicKeyBase64);
    const myPrivateKey = decodeBase64(privateKeyBase64);

    // Derive shared secret using ECDH
    const sharedSecret = nacl.box.before(partnerPublicKey, myPrivateKey);
    return sharedSecret;
  }

  /**
   * Cache shared secret for a pair (in memory only, never persisted)
   */
  private sharedSecretCache: Map<string, Uint8Array> = new Map();

  /**
   * Get or derive shared secret for a pair
   */
  async getSharedSecret(pairId: string, partnerPublicKey: string): Promise<Uint8Array> {
    // Check cache first
    if (this.sharedSecretCache.has(pairId)) {
      return this.sharedSecretCache.get(pairId)!;
    }

    // Derive and cache
    const sharedSecret = await this.deriveSharedSecret(partnerPublicKey);
    this.sharedSecretCache.set(pairId, sharedSecret);
    return sharedSecret;
  }

  /**
   * Clear cached shared secret (e.g., on logout or breakup)
   */
  clearSharedSecret(pairId?: string): void {
    if (pairId) {
      this.sharedSecretCache.delete(pairId);
    } else {
      // Clear all cached secrets
      this.sharedSecretCache.clear();
    }
  }

  /**
   * Encrypt text content using shared secret
   */
  async encryptText(text: string, sharedSecret: Uint8Array): Promise<string> {
    const nonce = nacl.randomBytes(24);
    const messageBytes = nacl.util.decodeUTF8(text);
    const encrypted = nacl.secretbox(messageBytes, nonce, sharedSecret);

    if (!encrypted) {
      throw new Error('Encryption failed');
    }

    // Combine nonce + encrypted data
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);

    return encodeBase64(combined);
  }

  /**
   * Decrypt text content using shared secret
   */
  async decryptText(encryptedBase64: string, sharedSecret: Uint8Array): Promise<string> {
    const combined = decodeBase64(encryptedBase64);
    const nonce = combined.slice(0, 24);
    const encrypted = combined.slice(24);

    const decrypted = nacl.secretbox.open(encrypted, nonce, sharedSecret);
    if (!decrypted) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }

    return nacl.util.encodeUTF8(decrypted);
  }

  /**
   * Encrypt voice file (ArrayBuffer) using shared secret
   */
  async encryptVoiceFile(
    audioData: ArrayBuffer,
    sharedSecret: Uint8Array
  ): Promise<{ encryptedData: Uint8Array; nonce: Uint8Array }> {
    const audioBytes = new Uint8Array(audioData);
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.secretbox(audioBytes, nonce, sharedSecret);

    if (!encrypted) {
      throw new Error('Voice encryption failed');
    }

    return { encryptedData: encrypted, nonce };
  }

  /**
   * Decrypt voice file using shared secret
   */
  async decryptVoiceFile(
    encryptedData: Uint8Array,
    nonce: Uint8Array,
    sharedSecret: Uint8Array
  ): Promise<Uint8Array> {
    const decrypted = nacl.secretbox.open(encryptedData, nonce, sharedSecret);
    if (!decrypted) {
      throw new Error('Voice decryption failed - invalid key or corrupted data');
    }
    return decrypted;
  }

  /**
   * Generate a random invite code
   */
  generateInviteCode(): string {
    const bytes = nacl.randomBytes(16);
    return encodeBase64(bytes).substring(0, 22); // Base64, 22 chars for readability
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
export default encryptionService;

