import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
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
  const loadingRef = useRef(false);
  const currentPartnerIdRef = useRef<string | null>(null);

  // Memoize loadPartner to prevent infinite loops
  const loadPartner = useCallback(async (partnerId: string, userId: string) => {
    // Prevent concurrent loads
    if (loadingRef.current) return;
    
    // Skip if already loading the same partner
    if (currentPartnerIdRef.current === partnerId) {
      return;
    }

    loadingRef.current = true;
    currentPartnerIdRef.current = partnerId;
    setLoading(true);

    try {
      const partnerData = await partnerService.getPartner(userId, partnerId);
      setPartner((prevPartner) => {
        // Only update if partner actually changed
        if (prevPartner?.id !== partnerData?.id) {
          return partnerData;
        }
        return prevPartner;
      });
    } catch (error) {
      console.error('Error loading partner:', error);
      setPartner(null);
      currentPartnerIdRef.current = null;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Initialize state when user changes
  useEffect(() => {
    if (!user) {
      setPartner(null);
      setConnectionStatus('unpaired');
      setLoading(false);
      loadingRef.current = false;
      currentPartnerIdRef.current = null;
      return;
    }

    // Update connectionStatus only if it changed
    const newStatus = user.connectionStatus || 'unpaired';
    setConnectionStatus((prevStatus) => {
      if (prevStatus !== newStatus) {
        return newStatus;
      }
      return prevStatus;
    });

    // Load partner if connected
    if (user.partnerId && newStatus === 'connected' && user.id) {
      if (currentPartnerIdRef.current !== user.partnerId) {
        loadPartner(user.partnerId, user.id);
      }
    } else {
      setPartner(null);
      setLoading(false);
      loadingRef.current = false;
      currentPartnerIdRef.current = null;
    }
  }, [user?.id, user?.partnerId, user?.connectionStatus, loadPartner]);

  // Listen to user document changes for connection status updates
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.id), (docSnapshot) => {
      if (!docSnapshot.exists()) {
        return;
      }

      const userData = docSnapshot.data() as Omit<User, 'id'>;
      const newConnectionStatus = userData.connectionStatus || 'unpaired';
      const newPartnerId = userData.partnerId;
      
      // Update connectionStatus only if it changed
      setConnectionStatus((prevStatus) => {
        if (prevStatus !== newConnectionStatus) {
          return newConnectionStatus;
        }
        return prevStatus;
      });

      // Load partner if connected and has partnerId
      if (newPartnerId && newConnectionStatus === 'connected') {
        // Only load if partnerId changed
        if (currentPartnerIdRef.current !== newPartnerId) {
          loadPartner(newPartnerId, user.id);
        }
      } else {
        setPartner(null);
        currentPartnerIdRef.current = null;
      }
    });

    return () => unsubscribe();
  }, [user?.id, loadPartner]);

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
    // Refresh user data to get updated partnerId and connectionStatus
    // The snapshot listener will also update, but this ensures immediate update
    if (user.id) {
      // Force reload partner after a short delay to allow Firestore to sync
      setTimeout(() => {
        const userDoc = doc(db, 'users', user.id);
        getDoc(userDoc).then((docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data() as Omit<User, 'id'>;
            const newPartnerId = userData.partnerId;
            const newConnectionStatus = userData.connectionStatus || 'unpaired';
            
            setConnectionStatus(newConnectionStatus);
            if (newPartnerId && newConnectionStatus === 'connected') {
              loadPartner(newPartnerId, user.id);
            }
          }
        });
      }, 500);
    }
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

