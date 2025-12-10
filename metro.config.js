const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .cjs modules (required for Firebase)
config.resolver.sourceExts.push('cjs');

// Disable experimental package exports (required to fix Firebase Auth registration error)
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

