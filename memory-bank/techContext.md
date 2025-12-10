# Technical Context: LoveNotes

## Technologies Used

### Frontend
- **React Native**: Cross-platform mobile framework
- **Expo**: Development platform and build system
- **TypeScript**: Type safety and developer experience
- **React Context API**: Global state management
- **AsyncStorage**: Local data persistence

### Backend & Services
- **Firebase Authentication**: User registration and login
- **Cloud Firestore**: NoSQL database for encrypted card data
- **Firebase Storage**: Encrypted voice file storage
- **Cloud Functions**: Server-side logic (if needed)

### Encryption
- **libsodium.js** or **TweetNaCl.js**: End-to-end encryption library
- **ECDH**: Key exchange protocol
- **Symmetric Encryption**: AES or ChaCha20-Poly1305 for card content

### Media & UI
- **expo-av**: Voice recording and playback
- **expo-sharing**: Share card content (Expo-compatible, no native modules required)
- **expo-media-library**: Media library access (for future image saving features)
- **expo-haptics**: Tactile feedback
- **react-native-qrcode-svg**: QR code generation for invite codes
- **react-native-safe-area-context**: Safe area handling for device notches/cutouts

## Development Setup

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI
- Firebase account and project
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation Commands
```bash
# Initialize Expo project
npx create-expo-app LoveNotes --template

# Core dependencies
npm install firebase @react-native-async-storage/async-storage

# Media and UI
npm install expo-av expo-sharing expo-media-library expo-haptics
npm install react-native-qrcode-svg react-native-safe-area-context

# Encryption
npm install libsodium-wrappers
# OR
npm install tweetnacl

# Development tools
npm install --save-dev @types/react @types/react-native
```

### Development Commands
```bash
npm run start      # Expo dev server
npm run android    # Build Android
npm run ios        # Build iOS
npm test           # Jest tests
```

## Technical Constraints

### Firebase Limits
- Firestore: 1MB document size limit
- Storage: 2MB file size limit (voice files must be compressed)
- Authentication: Standard Firebase Auth limits

### Mobile Constraints
- Voice files: Max 60 seconds, must be compressed
- Text cards: Max 200 characters
- Offline support: Cache encrypted data locally
- Battery: Efficient encryption/decryption operations

### Security Constraints
- No sensitive data in repository (use environment variables)
- Encryption keys never leave device unencrypted
- Shared secrets encrypted at rest in Firestore
- Voice files encrypted before upload

## Dependencies

### Production Dependencies
- `expo`: Expo SDK (~54.0.0)
- `react-native`: React Native core (^0.81.5)
- `firebase`: Firebase SDK (^10.7.1)
- `@react-native-async-storage/async-storage`: Local storage (^2.2.0)
- `expo-av`: Audio recording/playback (~16.0.8)
- `expo-sharing`: Share functionality (~14.0.8)
- `expo-media-library`: Media library access (~18.2.1)
- `expo-haptics`: Haptic feedback (~15.0.8)
- `react-native-qrcode-svg`: QR code generation (^6.2.0)
- `react-native-safe-area-context`: Safe area handling (~5.6.0)
- `tweetnacl`: Encryption (^1.0.3)
- `react-native-get-random-values`: Crypto polyfill for React Native (^2.0.0)

### Development Dependencies
- `typescript`: TypeScript compiler (~5.9.2)
- `@types/react`: React type definitions (~19.1.10)
- `@typescript-eslint/eslint-plugin`: ESLint TypeScript plugin (^6.19.0)
- `@typescript-eslint/parser`: ESLint TypeScript parser (^6.19.0)
- `eslint`: ESLint linter (^8.57.0)
- `jest`: Testing framework (^29.2.1)
- `@testing-library/react-native`: Testing utilities (^12.4.2)
- `react-test-renderer`: React test renderer (^19.1.0)

### Removed Dependencies (Expo Compatibility)
- `react-native-view-shot`: Removed - requires native modules not available in Expo Go
- `expo-gl`, `expo-gl-cpp`: Removed - not needed after switching to sharing solution

## Environment Configuration

### Required Environment Variables
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

### Firebase Configuration Files
- `.firebaserc`: Firebase project configuration
- `firebase.json`: Firebase deployment configuration
- `firestore.rules`: Security rules
- `storage.rules`: Storage security rules

## Build & Deployment

### CI/CD Pipeline
- GitHub Actions workflow for automated builds
- Automatic APK generation on push to main
- Firebase deployment for Cloud Functions
- Security rules validation

### Build Configuration
- Android: APK signing configuration
- iOS: Provisioning profiles (for App Store)
- Expo EAS Build for production builds

