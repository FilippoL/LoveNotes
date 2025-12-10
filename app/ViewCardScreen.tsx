import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import { useAuth } from '../contexts/AuthContext';
import { usePartner } from '../contexts/PartnerContext';
import { cardService } from '../services/cards';
import { encryptionService } from '../services/encryption';
import { partnerService } from '../services/partner';
import type { Card } from '../types';

export default function ViewCardScreen({ route, navigation }: any) {
  const { cardId } = route.params;
  const { user } = useAuth();
  const { partner } = usePartner();
  const [card, setCard] = useState<Card | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    loadCard();
    return () => {
      // Cleanup sound on unmount
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [cardId]);

  const loadCard = async () => {
    if (!user?.partnerId || !partner) return;

    try {
      const cardData = await cardService.getCard(cardId);
      if (!cardData) {
        Alert.alert('Error', 'Card not found');
        navigation.goBack();
        return;
      }

      setCard(cardData);

      // Decrypt if text card
      if (cardData.contentType === 'text') {
        const partnerPublicKey = await partnerService.getPartnerPublicKey(
          user.id,
          user.partnerId
        );
        const sharedSecret = await encryptionService.getSharedSecret(
          user.partnerId,
          partnerPublicKey
        );
        const decrypted = await cardService.decryptCard(cardData, sharedSecret);
        setDecryptedContent(decrypted);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load card');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handlePlayVoice = async () => {
    if (!card?.voiceUrl) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      // Download encrypted voice file
      const response = await fetch(card.voiceUrl);
      const encryptedBlob = await response.blob();
      const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();
      const encryptedData = new Uint8Array(encryptedArrayBuffer);

      // Extract nonce (first 24 bytes) and encrypted data
      const nonce = encryptedData.slice(0, 24);
      const encrypted = encryptedData.slice(24);

      // Get shared secret
      const partnerPublicKey = await partnerService.getPartnerPublicKey(
        user!.id,
        user!.partnerId!
      );
      const sharedSecret = await encryptionService.getSharedSecret(
        user!.partnerId!,
        partnerPublicKey
      );

      // Decrypt
      const decrypted = await encryptionService.decryptVoiceFile(
        encrypted,
        nonce,
        sharedSecret
      );

      // Create blob URL for playback
      const blob = new Blob([decrypted], { type: 'audio/m4a' });
      const uri = URL.createObjectURL(blob);

      // Play audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to play voice message');
    }
  };

  const handleStopVoice = async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  };

  const handleSaveAsImage = async () => {
    if (!viewShotRef.current) return;

    setSavingImage(true);
    try {
      // Request media library permissions
      if (Platform.OS !== 'web') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please grant media library permission to save images');
          setSavingImage(false);
          return;
        }
      }

      // Capture the card view as an image
      const uri = await viewShotRef.current.capture();
      
      if (!uri) {
        throw new Error('Failed to capture image');
      }

      // Save to media library
      if (Platform.OS !== 'web') {
        await MediaLibrary.createAssetAsync(uri);
        Alert.alert('Success', 'Card saved to your photos!');
      } else {
        // On web, use sharing instead
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert('Success', 'Image captured. Please save it manually.');
        }
      }
    } catch (error: any) {
      console.error('Error saving image:', error);
      Alert.alert('Error', error.message || 'Failed to save image');
    } finally {
      setSavingImage(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!card) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={styles.shotContainer}>
        <View style={styles.card}>
        {card.contentType === 'text' ? (
          <Text style={styles.cardText}>{decryptedContent || 'Loading...'}</Text>
        ) : (
          <View style={styles.voiceCard}>
            <Text style={styles.voiceLabel}>Voice Message</Text>
            {isPlaying ? (
              <TouchableOpacity
                style={styles.playButton}
                onPress={handleStopVoice}
              >
                <Text style={styles.playButtonText}>⏸ Pause</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayVoice}
              >
                <Text style={styles.playButtonText}>▶ Play</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {card.templateUsed && (
          <Text style={styles.templateLabel}>
            Template: {card.templateUsed}
          </Text>
        )}

        <Text style={styles.dateLabel}>
          {new Date(card.createdAt).toLocaleDateString()}
        </Text>
        </View>
      </ViewShot>

      <TouchableOpacity
        style={[styles.saveButton, savingImage && styles.saveButtonDisabled]}
        onPress={handleSaveAsImage}
        disabled={savingImage}
      >
        {savingImage ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save as Image</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
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
  },
  content: {
    padding: 24,
  },
  shotContainer: {
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    minHeight: 200,
    justifyContent: 'center',
  },
  cardText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
    textAlign: 'center',
  },
  voiceCard: {
    alignItems: 'center',
  },
  voiceLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  playButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  templateLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

