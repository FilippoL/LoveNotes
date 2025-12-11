// Polyfill for crypto.getRandomValues (required for TweetNaCl in React Native)
// Must be imported before any other imports that use crypto
import 'react-native-get-random-values';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PartnerProvider, usePartner } from './contexts/PartnerContext';
import LoginScreen from './app/LoginScreen';
import RegisterScreen from './app/RegisterScreen';
import ConnectScreen from './app/ConnectScreen';
import HomeScreen from './app/HomeScreen';
import CreateCardScreen from './app/CreateCardScreen';
import ViewCardScreen from './app/ViewCardScreen';
import SettingsScreen from './app/SettingsScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Navigation state persistence key - change this to clear old navigation state
const NAVIGATION_PERSISTENCE_KEY = 'NAVIGATION_STATE_V1';

function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Connect" component={ConnectScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen 
        name="CreateCard" 
        component={CreateCardScreen}
        options={{
          headerShown: true,
          title: 'Create Card',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="ViewCard" 
        component={ViewCardScreen}
        options={{
          headerShown: true,
          title: 'Card',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          headerShown: true,
          title: 'Settings',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading: authLoading } = useAuth();
  const { connectionStatus, loading: partnerLoading } = usePartner();

  if (authLoading || partnerLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!user) {
    return <AuthNavigator />;
  }

  return <MainNavigator />;
}

export default function App() {
  return (
    <NavigationContainer
      onReady={() => {
        // Clear any invalid navigation state on ready
      }}
    >
      <AuthProvider>
        <PartnerProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </PartnerProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
