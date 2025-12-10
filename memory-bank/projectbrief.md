# Project Brief: LoveNotes

## Core Mission
LoveNotes is a minimalistic relationship appreciation app connecting two users in a private, encrypted card-sharing system. It's designed as a digital sanctuary for intentional appreciation between partners.

## Project Goals
1. Create a secure, private space for two people to exchange appreciation
2. Implement end-to-end encryption for all content (text and voice)
3. Build a beautiful, minimalist UI focused on emotional presence
4. Ensure production-ready quality with robust error handling
5. Deploy with automated CI/CD pipeline

## Core Requirements

### Functional Requirements
- **User System**: Email/phone registration, one-to-one partner connection via invite codes, breakup feature
- **Card System**: 
  - Create cards: Text (max 200 chars) OR Voice recordings (max 60 sec)
  - Pre-built templates for guidance
  - Drawing cards: Random from partner's unread deck, 15-min cooldown
  - Rotation logic: Complete deck exhaustion before reshuffling
  - Save as image functionality
- **Security**: End-to-end encryption for all card content
- **UX**: Minimalist interface with two main buttons (Add, Pick)

### Technical Requirements
- **Frontend**: React Native (Expo) for cross-platform iOS/Android
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions)
- **State Management**: React Context + AsyncStorage for local cache
- **Encryption**: End-to-end encryption using libsodium.js or TweetNaCl.js
- **Deployment**: GitHub Actions CI/CD, automatic APK builds on push

## Success Criteria
- End-to-end encryption working perfectly
- Voice cards record/play without lag
- Partner connection flow seamless
- Card rotation algorithm foolproof
- APK builds automatically on push
- No sensitive data in repository
- All edge cases handled gracefully

## Project Scope
This is a production-ready mobile application that handles intimate expressions between partners. Security and emotional consideration are paramount in all implementation choices.

