# LoveNotes

A minimalistic relationship appreciation app connecting two users in a private, encrypted card-sharing system.

## Overview

LoveNotes is a digital sanctuary for intentional appreciation between partners. It provides a secure, private space for two people to exchange appreciation through text or voice cards, with end-to-end encryption ensuring complete privacy.

## Features

- **Secure Authentication**: Email/phone registration and login
- **Partner Connection**: One-to-one connection via invite codes or QR codes
- **Card Creation**: Create text cards (max 200 chars) or voice recordings (max 60 sec)
- **Card Templates**: Pre-built templates to guide your appreciation
- **Card Drawing**: Random card selection from partner's unread deck with 15-minute cooldown
- **Deck Rotation**: Complete deck exhaustion before reshuffling
- **End-to-End Encryption**: All card content encrypted before storage
- **Save as Image**: Beautiful card rendering with custom designs
- **Breakup Feature**: Clean severance with confirmation

## Tech Stack

- **Frontend**: React Native (Expo) with TypeScript
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions)
- **State Management**: React Context + AsyncStorage
- **Encryption**: End-to-end encryption (TweetNaCl.js)
- **Deployment**: GitHub Actions CI/CD

## Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase account and project
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd LoveNotes
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password and Phone)
3. Create a Firestore database
4. Create a Storage bucket
5. Copy your Firebase configuration to `.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

6. Copy `firestore.rules` and `storage.rules` to your Firebase project

### 4. Run the App

```bash
# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Development

### Project Structure

```
LoveNotes/
├── app/                    # App screens and navigation
├── components/             # Reusable components
├── services/              # Business logic (encryption, Firebase, etc.)
├── contexts/              # React Context providers
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
├── assets/                # Images, fonts, etc.
├── memory-bank/           # Project documentation
└── docs/                  # Additional documentation
```

### Key Services

- **EncryptionService**: Handles E2E encryption/decryption
- **AuthService**: Firebase authentication
- **CardService**: Card CRUD operations and rotation logic
- **PartnerService**: Partner connection management
- **VoiceService**: Voice recording, encryption, and playback

## Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm test -- --watch
```

## Security

- All card content is encrypted end-to-end
- Encryption keys never leave the device unencrypted
- Firebase security rules enforce data access restrictions
- No sensitive data stored in repository

## Deployment

The project uses GitHub Actions for CI/CD. On push to `main`:
- Runs tests
- Builds Android APK
- Deploys Firebase Cloud Functions (if any)

## Contributing

This is a private project. Please refer to the memory bank documentation for architecture and design decisions.

## License

Private - All rights reserved

## Support

For issues and questions, please refer to the documentation in `/docs` or `/memory-bank`.

