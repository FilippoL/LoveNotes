# Firebase Setup Guide

This guide walks you through setting up Firebase for the LoveNotes app.

## Prerequisites

- A Google account
- Firebase CLI installed (`npm install -g firebase-tools`)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `lovenotes-dev` (or your preferred name)
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Configure Authentication

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable the following providers:
   - **Email/Password**: Enable and save
   - **Phone**: Enable and configure (requires verification setup)

## Step 3: Create Firestore Database

1. Go to **Firestore Database** > **Create database**
2. Choose **Start in production mode** (we'll use security rules)
3. Select a location (choose closest to your users)
4. Click "Enable"

## Step 4: Set Up Cloud Storage

1. Go to **Storage** > **Get started**
2. Choose **Start in production mode**
3. Use the same location as Firestore
4. Click "Done"

## Step 5: Deploy Security Rules

1. Update `.firebaserc` with your project ID:
   ```json
   {
     "projects": {
       "default": "your-project-id"
     }
   }
   ```

2. Login to Firebase CLI:
   ```bash
   firebase login
   ```

3. Deploy Firestore rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

4. Deploy Storage rules:
   ```bash
   firebase deploy --only storage:rules
   ```

## Step 6: Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click the **Web** icon (`</>`)
4. Register app with nickname: "LoveNotes Web"
5. Copy the configuration values

## Step 7: Configure Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Important**: Never commit `.env` to version control. It's already in `.gitignore`.

## Step 8: Set Up Firestore Indexes

1. Deploy indexes:
   ```bash
   firebase deploy --only firestore:indexes
   ```

   Or manually create indexes in Firebase Console:
   - Go to **Firestore** > **Indexes**
   - Create composite index for `cards` collection:
     - Collection: `cards`
     - Fields: `pairId` (Ascending), `isRead` (Ascending), `createdAt` (Descending)

## Step 9: Configure Storage Rules

Storage rules are already defined in `storage.rules`. After deploying, verify:

1. Go to **Storage** > **Rules**
2. Verify rules match `storage.rules` file
3. Test rules using the Rules Playground

## Step 10: Set Up Cloud Functions (Optional)

Cloud Functions are optional but can be used for:
- Sending notifications
- Background processing
- Server-side validation

To set up:

```bash
cd functions
npm install
npm run build
```

## Verification Checklist

- [ ] Firebase project created
- [ ] Authentication enabled (Email/Password, Phone)
- [ ] Firestore database created
- [ ] Storage bucket created
- [ ] Security rules deployed
- [ ] Environment variables configured
- [ ] Firestore indexes created
- [ ] Firebase CLI authenticated

## Troubleshooting

### Rules Deployment Fails
- Ensure you're logged in: `firebase login`
- Check project ID in `.firebaserc` matches Firebase Console
- Verify you have Owner or Editor permissions

### Environment Variables Not Working
- Ensure variables start with `EXPO_PUBLIC_`
- Restart Expo dev server after changing `.env`
- Check `.env` file is in project root

### Storage Upload Fails
- Verify Storage rules allow authenticated users
- Check file size is under 2MB limit
- Ensure file extension is `.encrypted`

## Security Best Practices

1. **Never commit** `.env` or Firebase config files
2. **Review security rules** regularly
3. **Use environment-specific** Firebase projects (dev, staging, prod)
4. **Enable App Check** in production for additional security
5. **Monitor** Firebase usage and set up billing alerts

## Next Steps

After Firebase setup is complete:
1. Initialize Firebase in the app (see `services/firebase.ts`)
2. Test authentication flow
3. Test Firestore read/write operations
4. Test Storage upload/download

For more information, see the [Firebase Documentation](https://firebase.google.com/docs).

