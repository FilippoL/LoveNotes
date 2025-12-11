import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
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
  const [hasCards, setHasCards] = useState<boolean | null>(null);
  const [cooldownInfo, setCooldownInfo] = useState<{
    allowed: boolean;
    remainingMinutes: number;
    remainingSeconds: number;
  } | null>(null);
  const hasNavigatedRef = useRef(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Give state time to sync after navigation from Connect screen
    const timeoutId = setTimeout(() => {
      if (connectionStatus !== 'connected' || !user?.partnerId) {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          hasLoadedRef.current = false;
          navigation.replace('Connect');
        }
        return;
      } else {
        hasNavigatedRef.current = false;
      }

      // Load data when conditions are met
      if (connectionStatus === 'connected' && user?.partnerId) {
        if (!hasLoadedRef.current) {
          hasLoadedRef.current = true;
          loadRecentCards();
          checkHasCards();
          checkCooldown();
        }
      } else {
        hasLoadedRef.current = false;
      }
    }, 500); // Wait 500ms for state to sync

    return () => clearTimeout(timeoutId);
  }, [connectionStatus, user?.partnerId]);

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


  const checkHasCards = async () => {
    if (!user?.partnerId) return;

    try {
      const allCards = await cardService.getAllCards(user.partnerId);
      setHasCards(allCards.length > 0);
    } catch (error) {
      console.error('Error checking cards:', error);
      setHasCards(null);
    }
  };

  const checkCooldown = async () => {
    if (!user?.partnerId || !user?.id) return;

    try {
      const info = await cardService.checkCooldown(user.partnerId, user.id);
      setCooldownInfo(info);
    } catch (error) {
      console.error('Error checking cooldown:', error);
      // If index error, set cooldown to allowed (will be checked again when index is ready)
      setCooldownInfo({ allowed: true, remainingMinutes: 0, remainingSeconds: 0 });
    }
  };

  // Update cooldown display every second when on cooldown
  useEffect(() => {
    if (!cooldownInfo || cooldownInfo.allowed) return;

    const interval = setInterval(() => {
      setCooldownInfo((prev) => {
        if (!prev || prev.allowed) return prev;
        
        let newSeconds = prev.remainingSeconds - 1;
        let newMinutes = prev.remainingMinutes;

        if (newSeconds < 0) {
          if (newMinutes > 0) {
            newMinutes -= 1;
            newSeconds = 59;
          } else {
            // Cooldown expired, check again
            checkCooldown();
            return { allowed: true, remainingMinutes: 0, remainingSeconds: 0 };
          }
        }

        return {
          allowed: false,
          remainingMinutes: newMinutes,
          remainingSeconds: newSeconds,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownInfo?.allowed, cooldownInfo?.remainingMinutes, cooldownInfo?.remainingSeconds]);

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
      console.error('Error drawing card:', error);
      Alert.alert('Error', error.message || 'Failed to draw card. Please try again.');
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
          <Text style={styles.greeting}>Hello, {user?.displayName || user?.email?.split('@')[0] || 'User'}</Text>
          <TouchableOpacity
            style={styles.settingsIconButton}
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
            <Text style={styles.settingsLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
        {partner && (
          <Text style={styles.partnerName}>Connected with your partner</Text>
        )}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleAddCard}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Image 
              source={require('../assets/icons/writecard.png')}
              style={styles.actionButtonIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.actionButtonText}>Write a Note</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.drawButton,
            (!cooldownInfo?.allowed || loading || hasCards === false) && styles.buttonDisabled,
          ]}
          onPress={handleDrawCard}
          disabled={!cooldownInfo?.allowed || loading || hasCards === false}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Image 
              source={require('../assets/icons/pickcard.png')}
              style={styles.actionButtonIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.actionButtonText}>Draw a Note</Text>
          {cooldownInfo && !cooldownInfo.allowed && (
            <Text style={styles.cooldownText}>
              {cooldownInfo.remainingMinutes}m {cooldownInfo.remainingSeconds}s
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
    paddingTop: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  settingsIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: 16,
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
  partnerName: {
    fontSize: 16,
    color: '#666',
  },
  actionsContainer: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    marginBottom: 32,
    gap: 16,
    flex: 1,
    minHeight: Dimensions.get('window').height * 0.6,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  drawButton: {
    backgroundColor: '#8b5cf6',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: '100%',
    height: 150,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonIcon: {
    width: 150,
    height: 150,
    tintColor: '#fff',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
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
});

