import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { usePartner } from '../contexts/PartnerContext';
import { cardService } from '../services/cards';
import { encryptionService } from '../services/encryption';
import { partnerService } from '../services/partner';
import type { Card } from '../types';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { partner, connectionStatus } = usePartner();
  const [recentCards, setRecentCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [cooldownInfo, setCooldownInfo] = useState<{
    allowed: boolean;
    remainingMinutes: number;
  } | null>(null);

  useEffect(() => {
    if (connectionStatus !== 'connected' || !user?.partnerId) {
      navigation.replace('Connect');
      return;
    }

    loadRecentCards();
    checkCooldown();
  }, [user, partner, connectionStatus]);

  const loadRecentCards = async () => {
    if (!user?.partnerId) return;

    try {
      const draws = await cardService.getRecentDraws(user.partnerId, 5);
      setRecentCards(draws as any);
    } catch (error) {
      console.error('Error loading recent cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkCooldown = async () => {
    if (!user?.partnerId || !user?.id) return;

    try {
      const info = await cardService.checkCooldown(user.partnerId, user.id);
      setCooldownInfo(info);
    } catch (error) {
      console.error('Error checking cooldown:', error);
    }
  };

  const handleAddCard = () => {
    navigation.navigate('CreateCard');
  };

  const handleDrawCard = async () => {
    if (!user?.partnerId || !user?.id || !partner) return;

    if (!cooldownInfo?.allowed) {
      return; // Button should be disabled
    }

    try {
      // Get shared secret
      const partnerPublicKey = await partnerService.getPartnerPublicKey(
        user.id,
        user.partnerId
      );
      const sharedSecret = await encryptionService.getSharedSecret(
        user.partnerId,
        partnerPublicKey
      );

      // Draw card
      const card = await cardService.drawRandomCard(
        user.partnerId,
        user.id,
        sharedSecret
      );

      if (card) {
        navigation.navigate('ViewCard', { cardId: card.id });
      } else {
        Alert.alert('No Cards', 'There are no cards available to draw.');
      }

      // Refresh cooldown and recent cards
      await checkCooldown();
      await loadRecentCards();
    } catch (error: any) {
      // Error handling
      console.error('Error drawing card:', error);
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
        <View style={styles.headerTop}>
          <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0]}</Text>
          <TouchableOpacity
            style={styles.settingsIconButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
        {partner && (
          <Text style={styles.partnerName}>Connected with your partner</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleAddCard}>
          <Text style={styles.actionButtonIcon}>✍️</Text>
          <Text style={styles.actionButtonText}>Add Card</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.drawButton,
            (!cooldownInfo?.allowed || loading) && styles.buttonDisabled,
          ]}
          onPress={handleDrawCard}
          disabled={!cooldownInfo?.allowed || loading}
        >
          <Text style={styles.actionButtonIcon}>🎴</Text>
          <Text style={styles.actionButtonText}>Draw Card</Text>
          {cooldownInfo && !cooldownInfo.allowed && (
            <Text style={styles.cooldownText}>
              {cooldownInfo.remainingMinutes}m
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {recentCards.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Cards</Text>
          {recentCards.map((draw: any) => (
            <TouchableOpacity
              key={draw.id}
              style={styles.recentCard}
              onPress={() => navigation.navigate('ViewCard', { cardId: draw.cardId })}
            >
              <Text style={styles.recentCardText}>
                Card drawn {new Date(draw.drawnAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
  header: {
    padding: 24,
    paddingTop: 48,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 16,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 32,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  drawButton: {
    backgroundColor: '#8b5cf6',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButtonIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cooldownText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  recentSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  recentCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  recentCardText: {
    fontSize: 14,
    color: '#666',
  },
  },
});

