# System Patterns: LoveNotes

## Architecture Overview

### High-Level Architecture
```
Mobile App (React Native/Expo)
    ↓
Firebase Services
    ├── Authentication
    ├── Firestore (encrypted data)
    ├── Storage (encrypted voice files)
    └── Cloud Functions (server-side logic)
```

### Component Structure
```
App
├── AuthNavigator
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── ForgotPasswordScreen
├── MainNavigator
│   ├── ConnectScreen (if unpaired)
│   └── MainApp (if paired)
│       ├── HomeScreen
│       │   ├── AddCardButton
│       │   ├── DrawCardButton (with Timer)
│       │   └── RecentCards
│       ├── CreateCardScreen
│       │   ├── TextInput
│       │   ├── VoiceRecorder
│       │   └── TemplateSelector
│       ├── ViewCardScreen
│       │   ├── CardDisplay
│       │   ├── ShareCardButton
│       │   └── VoicePlayer
│       └── SettingsScreen
│           ├── PartnerInfo
│           └── BreakupButton
```

## Key Technical Decisions

### Encryption Strategy
- **Library**: libsodium.js or TweetNaCl.js for E2E encryption
- **Key Exchange**: ECDH during pairing
- **Symmetric Encryption**: Shared secret derived from key exchange
- **Storage**: Encrypted content in Firestore, encrypted blobs in Storage

### State Management Pattern
- **React Context**: Global app state (auth, partner connection)
- **AsyncStorage**: Local cache for offline support and performance
- **Optimistic Updates**: Immediate UI feedback for card creation

### Card Rotation Algorithm
- **Unread Cards First**: Always draw from unread deck
- **Complete Cycle**: All cards must be read before reshuffling
- **Cooldown**: 15-minute timer between draws
- **Reset Logic**: Mark all cards as unread when deck exhausted

### Partner Connection State Machine
- **States**: Unpaired → Pending → Connected → Broken
- **Transitions**: 
  - Unpaired → Pending: Invite code generated/scanned
  - Pending → Connected: Partner accepts invite
  - Connected → Broken: Breakup initiated

## Design Patterns

### Encryption Flow Pattern
1. Generate keypair (public/private) on registration
2. Exchange public keys during pairing
3. Derive shared secret using ECDH
4. Encrypt shared secret with each user's public key
5. Store encrypted shared secrets in Firestore
6. Use shared secret for symmetric encryption of cards

### Voice Processing Pipeline
1. Record voice (expo-av)
2. Convert to ArrayBuffer
3. Encrypt with shared secret
4. Upload encrypted blob to Firebase Storage
5. Store reference in Firestore
6. Download → Decrypt → Play

### Card Creation Pattern
1. User selects type (text/voice)
2. Optional template selection
3. Content creation
4. Encryption with shared secret
5. Upload to Firebase (Firestore + Storage if voice)
6. Optimistic UI update
7. Sync confirmation

## Component Relationships
- **AuthContext**: Manages authentication state, provides to all screens
- **PartnerContext**: Manages partner connection state, card deck state
- **EncryptionService**: Singleton service for all encryption operations
- **CardService**: Handles card CRUD operations, rotation logic
- **VoiceService**: Manages voice recording, encryption, upload, playback

## Data Flow Patterns
- **Read**: Firestore → Decrypt → Display
- **Write**: User Input → Encrypt → Firestore
- **Voice**: Record → Encrypt → Storage → Reference in Firestore
- **Offline**: Cache encrypted data locally, sync when online

