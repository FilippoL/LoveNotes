# Encryption Guide

This document describes the end-to-end encryption implementation for LoveNotes.

## Overview

All card content (text and voice) is encrypted end-to-end using TweetNaCl.js, ensuring that only the two partners can read each other's cards. Even Firebase administrators cannot decrypt the content.

## Encryption Architecture

### Key Exchange Flow

1. **User Registration**:
   - Each user generates a keypair (public/private) using `nacl.box.keyPair()`
   - Public key is stored in Firestore `users/{userId}/publicKey`
   - Private key is stored locally in AsyncStorage (never sent to server)

2. **Partner Connection**:
   - User A generates an invite code containing their public key
   - User B scans/enters invite code and receives User A's public key
   - Both users exchange public keys via Firestore
   - Each user derives a shared secret using ECDH: `nacl.box.before(userAPublicKey, userBPrivateKey)`
   - Shared secret is encrypted with each user's public key and stored in Firestore

3. **Card Encryption**:
   - Text cards: Encrypted using shared secret with `nacl.secretbox()`
   - Voice files: Encrypted using shared secret before upload to Storage

## Implementation Details

### Key Generation

```typescript
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

// Generate keypair on registration
const keypair = nacl.box.keyPair();
const publicKey = encodeBase64(keypair.publicKey);
const privateKey = encodeBase64(keypair.secretKey);

// Store private key locally (never on server)
await AsyncStorage.setItem('privateKey', privateKey);

// Store public key in Firestore
await firestore.collection('users').doc(userId).set({
  publicKey: publicKey,
  // ... other user data
});
```

### Shared Secret Derivation

```typescript
// User A derives shared secret from User B's public key
const partnerPublicKey = decodeBase64(partnerPublicKeyBase64);
const myPrivateKey = decodeBase64(await AsyncStorage.getItem('privateKey'));
const sharedSecret = nacl.box.before(partnerPublicKey, myPrivateKey);
```

### Text Card Encryption

```typescript
// Encrypt text content
function encryptText(text: string, sharedSecret: Uint8Array): string {
  const nonce = nacl.randomBytes(24);
  const messageBytes = nacl.util.decodeUTF8(text);
  const encrypted = nacl.secretbox(messageBytes, nonce, sharedSecret);
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

// Decrypt text content
function decryptText(encryptedBase64: string, sharedSecret: Uint8Array): string {
  const combined = decodeBase64(encryptedBase64);
  const nonce = combined.slice(0, 24);
  const encrypted = combined.slice(24);
  const decrypted = nacl.secretbox.open(encrypted, nonce, sharedSecret);
  if (!decrypted) {
    throw new Error('Decryption failed');
  }
  return nacl.util.encodeUTF8(decrypted);
}
```

### Voice File Encryption

```typescript
// Encrypt voice file before upload
async function encryptVoiceFile(
  audioUri: string,
  sharedSecret: Uint8Array
): Promise<{ encryptedData: Uint8Array; nonce: Uint8Array }> {
  // Read audio file as ArrayBuffer
  const response = await fetch(audioUri);
  const arrayBuffer = await response.arrayBuffer();
  const audioData = new Uint8Array(arrayBuffer);
  
  // Generate nonce
  const nonce = nacl.randomBytes(24);
  
  // Encrypt
  const encrypted = nacl.secretbox(audioData, nonce, sharedSecret);
  
  return { encryptedData: encrypted, nonce };
}

// Decrypt voice file after download
function decryptVoiceFile(
  encryptedData: Uint8Array,
  nonce: Uint8Array,
  sharedSecret: Uint8Array
): Uint8Array {
  const decrypted = nacl.secretbox.open(encryptedData, nonce, sharedSecret);
  if (!decrypted) {
    throw new Error('Voice decryption failed');
  }
  return decrypted;
}
```

## Security Considerations

### Key Storage
- **Private keys**: Stored only in AsyncStorage, never transmitted
- **Public keys**: Stored in Firestore, safe to expose
- **Shared secrets**: Derived locally, never stored on server

### Key Rotation
If a user's private key is compromised:
1. Generate new keypair
2. Update public key in Firestore
3. Re-establish connection with partner
4. Old cards remain encrypted with old shared secret (cannot be decrypted)

### Forward Secrecy
LoveNotes does not implement forward secrecy. If a private key is compromised, all past messages can be decrypted. This is acceptable for this use case as:
- Cards are meant to be read and appreciated
- The app is designed for trusted partners
- Implementing forward secrecy would significantly complicate the architecture

## Error Handling

### Decryption Failures
- If decryption fails, display error message to user
- Log error for debugging (without sensitive data)
- Suggest re-establishing connection with partner

### Key Mismatch
- If shared secret derivation fails, prompt user to reconnect
- Clear local shared secret cache
- Regenerate connection

## Testing

### Unit Tests
```typescript
describe('EncryptionService', () => {
  it('should encrypt and decrypt text correctly', () => {
    const text = 'Hello, LoveNotes!';
    const sharedSecret = nacl.randomBytes(32);
    const encrypted = encryptText(text, sharedSecret);
    const decrypted = decryptText(encrypted, sharedSecret);
    expect(decrypted).toBe(text);
  });
  
  it('should fail decryption with wrong key', () => {
    const text = 'Hello, LoveNotes!';
    const correctKey = nacl.randomBytes(32);
    const wrongKey = nacl.randomBytes(32);
    const encrypted = encryptText(text, correctKey);
    expect(() => decryptText(encrypted, wrongKey)).toThrow();
  });
});
```

## Performance Considerations

- Encryption/decryption is synchronous and fast for text (< 1ms)
- Voice file encryption may take longer for large files (60s audio ~2MB)
- Consider encrypting in chunks for very large files
- Cache shared secrets in memory to avoid repeated derivation

## Future Enhancements

- Key backup/restore mechanism
- Multi-device support with key sync
- Optional key escrow for account recovery
- Performance optimizations for large voice files

## References

- [TweetNaCl.js Documentation](https://github.com/dchest/tweetnacl-js)
- [NaCl: Networking and Cryptography library](https://nacl.cr.yp.to/)
- [End-to-End Encryption Best Practices](https://www.owasp.org/index.php/Cryptographic_Storage_Cheat_Sheet)

