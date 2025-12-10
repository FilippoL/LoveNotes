import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { usePartner } from '../contexts/PartnerContext';

export default function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { partner, breakup } = usePartner();
  const [breakingUp, setBreakingUp] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleBreakup = () => {
    Alert.alert(
      'Break Up',
      'Are you sure you want to break up with your partner? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Break Up',
          style: 'destructive',
          onPress: async () => {
            setBreakingUp(true);
            try {
              await breakup();
              Alert.alert('Success', 'Connection severed', [
                { text: 'OK', onPress: () => navigation.replace('Connect') },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to break up');
            } finally {
              setBreakingUp(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to log out');
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>
      </View>

      {/* Partner Info */}
      {partner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partner</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Connected with</Text>
            <Text style={styles.infoValue}>{partner.email}</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        {partner && (
          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleBreakup}
            disabled={breakingUp}
          >
            {breakingUp ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Break Up</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Log Out</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.appInfo}>LoveNotes v1.0.0</Text>
        <Text style={styles.appInfoSubtext}>
          A digital sanctuary for mutual appreciation
        </Text>
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
    paddingBottom: 40, // Extra padding at bottom to ensure logout button is visible
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    color: '#333',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  actionButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    marginBottom: 24,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 4,
  },
  appInfoSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

