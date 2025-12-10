# Environment Setup Guide

This guide explains how to set up your development environment for LoveNotes.

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# Optional: Environment
EXPO_PUBLIC_ENV=development
```

**Important**: 
- Never commit `.env` to version control (already in `.gitignore`)
- All Expo environment variables must be prefixed with `EXPO_PUBLIC_`
- Restart Expo dev server after changing `.env` values

## Getting Firebase Credentials

See [Firebase Setup Guide](./firebase-setup.md) for detailed instructions on obtaining these values.

## Development Workflow

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Up Environment**:
   - Copy `.env.example` to `.env` (if it exists)
   - Fill in Firebase credentials

3. **Start Development Server**:
   ```bash
   npm start
   ```

4. **Run on Device/Emulator**:
   ```bash
   # Android
   npm run android
   
   # iOS (macOS only)
   npm run ios
   ```

## Troubleshooting

### Environment Variables Not Loading
- Ensure variables start with `EXPO_PUBLIC_`
- Restart Expo dev server
- Clear Expo cache: `npx expo start -c`

### Firebase Connection Issues
- Verify `.env` file exists and has correct values
- Check Firebase project is active
- Verify internet connection

### Build Errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Expo cache: `npx expo start -c`
- Check Node.js version: `node --version` (should be 18+)

