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
  const { user, refreshUser } = useAuth();
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

  // Initialize state when user ID changes (not when user object reference changes)
  useEffect(() => {
    if (!user) {
      setPartner(null);
      setConnectionStatus('unpaired');
      setLoading(false);
      loadingRef.current = false;
      currentPartnerIdRef.current = null;
      return;
    }

    // Don't override connectionStatus if it's already set (snapshot listener is source of truth)
    // Only initialize if still unpaired
    const newStatus = user.connectionStatus || 'unpaired';
    setConnectionStatus((prevStatus) => {
      // Only update if we're still unpaired and user has a different status
      if (prevStatus === 'unpaired' && newStatus !== 'unpaired') {
        return newStatus;
      }
      // Don't override if already connected - snapshot listener handles updates
      return prevStatus;
    });

    // Load partner if connected (only if partnerId exists and we haven't loaded it)
    if (user.partnerId && user.connectionStatus === 'connected' && user.id) {
      if (currentPartnerIdRef.current !== user.partnerId) {
        loadPartner(user.partnerId, user.id);
      }
    } else if (!user.partnerId) {
      // Only clear partner if user doesn't have partnerId
      setPartner(null);
      setLoading(false);
      loadingRef.current = false;
      currentPartnerIdRef.current = null;
    }
  }, [user?.id]); // Only depend on user ID, not connectionStatus or partnerId

  // Listen to user document changes for connection status updates (source of truth)
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isSubscribed = true;

    const unsubscribe = onSnapshot(doc(db, 'users', user.id), (docSnapshot) => {
      if (!isSubscribed || !docSnapshot.exists()) {
        return;
      }

      const userData = docSnapshot.data() as Omit<User, 'id'>;
      const newConnectionStatus = userData.connectionStatus || 'unpaired';
      const newPartnerId = userData.partnerId;
      
      // Update connectionStatus only if it changed
      setConnectionStatus((prevStatus) => {
        if (prevStatus !== newConnectionStatus) {
          console.log('[PartnerContext] Snapshot listener - connectionStatus changed from', prevStatus, 'to', newConnectionStatus, 'partnerId:', newPartnerId);
          return newConnectionStatus;
        }
        return prevStatus;
      });

      // Load partner if connected and has partnerId
      if (newPartnerId && newConnectionStatus === 'connected') {
        // Only load if partnerId changed and we're not already loading
        if (currentPartnerIdRef.current !== newPartnerId && !loadingRef.current) {
          loadPartner(newPartnerId, user.id);
        }
      } else {
        if (currentPartnerIdRef.current !== null) {
          setPartner(null);
          currentPartnerIdRef.current = null;
        }
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [user?.id]);

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

    // Accept the invite code - this updates Firestore
    await partnerService.acceptInviteCode(code, user);
    
    // Refresh AuthContext user data to get updated partnerId - force refresh from Firestore
    await refreshUser(true);
    
    // Manually update connectionStatus immediately from Firestore
    // This ensures it's set before navigation happens
    if (user.id) {
      try {
        const userDoc = doc(db, 'users', user.id);
        const docSnapshot = await getDoc(userDoc);
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data() as Omit<User, 'id'>;
          const newConnectionStatus = userData.connectionStatus || 'unpaired';
          const newPartnerId = userData.partnerId;
          
      // Update connection status immediately
      console.log('[PartnerContext] acceptInviteCode - Setting connectionStatus to:', newConnectionStatus, 'partnerId:', newPartnerId);
      setConnectionStatus(newConnectionStatus);
      
      // Load partner if connected
      if (newPartnerId && newConnectionStatus === 'connected') {
        currentPartnerIdRef.current = null; // Reset to allow loading
        loadPartner(newPartnerId, user.id);
      }
        }
      } catch (error) {
        console.error('Error updating connection status after pairing:', error);
      }
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

