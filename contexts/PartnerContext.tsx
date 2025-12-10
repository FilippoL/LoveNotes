import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { partnerService } from '../services/partner';
import { useAuth } from './AuthContext';
import type { User, ConnectionStatus } from '../types';

interface PartnerContextType {
  partner: User | null;
  connectionStatus: ConnectionStatus;
  loading: boolean;
  generateInviteCode: () => Promise<string>;
  acceptInviteCode: (code: string) => Promise<void>;
  breakup: () => Promise<void>;
  refreshPartner: () => Promise<void>;
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

interface PartnerProviderProps {
  children: ReactNode;
}

export const PartnerProvider: React.FC<PartnerProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [partner, setPartner] = useState<User | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unpaired');
  const [loading, setLoading] = useState<boolean>(true);

  // Load partner data when user changes
  useEffect(() => {
    if (!user) {
      setPartner(null);
      setConnectionStatus('unpaired');
      setLoading(false);
      return;
    }

    setConnectionStatus(user.connectionStatus);
    loadPartner();
  }, [user]);

  // Listen to user document changes for connection status updates
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.id), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data() as Omit<User, 'id'>;
        setConnectionStatus(userData.connectionStatus || 'unpaired');

        // Reload partner if connection status changed
        if (userData.partnerId && userData.connectionStatus === 'connected') {
          loadPartner();
        } else {
          setPartner(null);
        }
      }
    });

    return () => unsubscribe();
  }, [user?.id]);

  const loadPartner = async () => {
    if (!user?.partnerId) {
      setPartner(null);
      setLoading(false);
      return;
    }

    try {
      const partnerData = await partnerService.getPartner(user.id, user.partnerId);
      setPartner(partnerData);
    } catch (error) {
      console.error('Error loading partner:', error);
      setPartner(null);
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = async (): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!user.publicKey) {
      throw new Error('Your account is missing encryption keys. Please log out and sign up again.');
    }

    if (user.partnerId) {
      throw new Error('You are already paired with a partner');
    }

    try {
      return await partnerService.generateInviteCode(user.id, user.publicKey);
    } catch (error: any) {
      console.error('Error in generateInviteCode:', error);
      throw error;
    }
  };

  const acceptInviteCode = async (code: string): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    await partnerService.acceptInviteCode(code, user);
    // Partner will be reloaded via snapshot listener
  };

  const breakup = async (): Promise<void> => {
    if (!user?.partnerId) {
      throw new Error('No partner to break up with');
    }

    await partnerService.breakup(user.id, user.partnerId);
    setPartner(null);
    setConnectionStatus('broken');
  };

  const refreshPartner = async (): Promise<void> => {
    await loadPartner();
  };

  const value: PartnerContextType = {
    partner,
    connectionStatus,
    loading,
    generateInviteCode,
    acceptInviteCode,
    breakup,
    refreshPartner,
  };

  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>;
};

export const usePartner = (): PartnerContextType => {
  const context = useContext(PartnerContext);
  if (context === undefined) {
    throw new Error('usePartner must be used within a PartnerProvider');
  }
  return context;
};

