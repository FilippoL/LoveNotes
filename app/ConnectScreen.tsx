import React, { useState, useEffect } from 'react';
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
import QRCode from 'react-native-qrcode-svg';
import { usePartner } from '../contexts/PartnerContext';
import { useAuth } from '../contexts/AuthContext';

export default function ConnectScreen({ navigation }: any) {
  const { connectionStatus, generateInviteCode, acceptInviteCode, loading } = usePartner();
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    // If already connected, navigate away
    if (connectionStatus === 'connected') {
      navigation.replace('Home');
    }
  }, [connectionStatus, navigation]);

  const handleGenerateInvite = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const code = await generateInviteCode();
      setInviteCode(code);
    } catch (error: any) {
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
      await acceptInviteCode(inputCode.trim());
      Alert.alert('Success', 'You are now connected with your partner!', [
        { text: 'OK', onPress: () => navigation.replace('Home') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invite code');
    } finally {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Connect with Your Partner</Text>
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
  );
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
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

