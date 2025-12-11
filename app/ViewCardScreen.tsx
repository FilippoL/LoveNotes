import React, { useEffect, useState } from 'react';
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
import { decodeBase64 } from 'tweetnacl-util';
import { SafeAreaView } from 'react-native-safe-area-context';
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

      // Download encrypted voice file (stored as base64 string)
      const response = await fetch(card.voiceUrl);
      const base64String = await response.text();
      const encryptedData = decodeBase64(base64String);

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
    if (!card || !decryptedContent) {
      Alert.alert('Error', 'Card content not available');
      return;
    }

    setSavingImage(true);
    try {
      // Create a text representation of the card
      const cardText = card.contentType === 'text'
        ? decryptedContent
        : 'Voice Message Card';
      
      const date = new Date(card.createdAt).toLocaleDateString();
      const shareText = `LoveNotes Card\n\n${cardText}\n\nDate: ${date}${card.templateUsed ? `\nTemplate: ${card.templateUsed}` : ''}`;

      // Share the card content
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync({
          message: shareText,
          mimeType: 'text/plain',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device');
      }
    } catch (error: any) {
      console.error('Error sharing card:', error);
      Alert.alert('Error', error.message || 'Failed to share card');
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

        <Text style={styles.dateLabel}>
          {new Date(card.createdAt).toLocaleDateString()}
        </Text>
        </View>

      <TouchableOpacity
        style={[styles.saveButton, savingImage && styles.saveButtonDisabled]}
        onPress={handleSaveAsImage}
        disabled={savingImage}
      >
        {savingImage ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Share Card</Text>
        )}
      </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
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

