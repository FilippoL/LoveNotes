import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { usePartner } from '../contexts/PartnerContext';
import { useAuth } from '../contexts/AuthContext';

export default function ConnectScreen({ navigation }: any) {
  const { generateInviteCode, acceptInviteCode, loading, connectionStatus } = usePartner();
  const { user, refreshUser } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const hasNavigatedRef = React.useRef(false);

  // Auto-navigate to Home when connected
  React.useEffect(() => {
    console.log('[ConnectScreen] connectionStatus:', connectionStatus, 'partnerId:', user?.partnerId, 'hasNavigated:', hasNavigatedRef.current);
    if (connectionStatus === 'connected' && user?.partnerId && !hasNavigatedRef.current) {
      console.log('[ConnectScreen] Navigating to Home...');
      hasNavigatedRef.current = true;
      // Small delay to ensure state is fully synced
      setTimeout(() => {
        console.log('[ConnectScreen] Executing navigation.replace("Home")');
        navigation.replace('Home');
      }, 300);
    } else if (connectionStatus !== 'connected') {
      hasNavigatedRef.current = false;
    }
  }, [connectionStatus, user?.partnerId, navigation]);

  const handleGenerateInvite = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    if (!user.publicKey) {
      Alert.alert('Error', 'Your account is missing encryption keys. Please log out and sign up again.');
      return;
    }

    setGenerating(true);
    try {
      const code = await generateInviteCode();
      setInviteCode(code);
    } catch (error: any) {
      console.error('Error generating invite code:', error);
      Alert.alert('Error', error.message || 'Failed to generate invite code');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteCode) return;

    try {
      await Share.share({
        message: `Join me on LoveNotes! Use this invite code: ${inviteCode}`,
        title: 'LoveNotes Invite',
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to share invite code');
    }
  };

  const handleAcceptInvite = async () => {
    if (!inputCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setAccepting(true);
    try {
      // Accept invite code - this updates Firestore and state
      await acceptInviteCode(inputCode.trim());
      
      // Ensure user data is refreshed - wait for it to complete
      await refreshUser();
      
      setInputCode('');
      
      // Wait a moment for React state to propagate
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Show success message
      // Navigation will happen automatically via useEffect when state updates
      Alert.alert('Success', 'You are now connected with your partner!');
      setAccepting(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invite code');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Connect with Your Partner</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
            <Text style={styles.settingsLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Generate an invite code or enter one from your partner
        </Text>

      {/* Generate Invite Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Generate Invite Code</Text>
        <Text style={styles.sectionDescription}>
          Create a code to share with your partner
        </Text>

        {inviteCode ? (
          <View style={styles.inviteDisplay}>
            <View style={styles.qrContainer}>
              <QRCode
                value={inviteCode}
                size={200}
                color="#000"
                backgroundColor="#fff"
              />
            </View>
            <Text style={styles.inviteCode}>{inviteCode}</Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareInvite}
            >
              <Text style={styles.shareButtonText}>Share Invite Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, generating && styles.buttonDisabled]}
            onPress={handleGenerateInvite}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Generate Invite Code</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Accept Invite Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Enter Invite Code</Text>
        <Text style={styles.sectionDescription}>
          Enter the code your partner shared with you
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter invite code"
          value={inputCode}
          onChangeText={setInputCode}
          autoCapitalize="none"
          editable={!accepting}
        />

        <TouchableOpacity
          style={[styles.button, accepting && styles.buttonDisabled]}
          onPress={handleAcceptInvite}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    flex: 1,
    color: '#333',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  settingsIcon: {
    fontSize: 20,
    marginRight: 4,
  },
  settingsLabel: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  inviteDisplay: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16,
    color: '#333',
    fontFamily: 'monospace',
  },
  shareButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 2,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

