import { create } from 'zustand';
import { auth, db, googleProvider } from '../config/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onIdTokenChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import type { UserProfile } from '../types';
import { calculateLevelFromXP } from '../utils/levelCalculator';
import { resolveUserAvatar } from '../utils/avatarResolver';

function mapAuthOrProfileError(error: any): Error {
  const code = error?.code || '';
  const msg = String(error?.message || '');
  if (code === 'auth/email-already-in-use') {
    return Object.assign(new Error('This email address is already registered. Please sign in instead.'), { code });
  }
  if (code === 'auth/invalid-email') {
    return Object.assign(new Error('Invalid email address. Please check and try again.'), { code });
  }
  if (code === 'auth/weak-password') {
    return Object.assign(new Error('Weak password. Please choose a password with at least 6 characters.'), { code });
  }
  if (code === 'auth/popup-closed-by-user') {
    return Object.assign(new Error('Google sign-in was cancelled before completing.'), { code });
  }
  if (code === 'permission-denied' || msg.toLowerCase().includes('missing or insufficient permissions')) {
    return Object.assign(new Error('Profile creation permission denied. Please retry or sign in again.'), { code: 'permission-denied' });
  }
  if (code === 'unavailable') {
    return Object.assign(new Error('Database unavailable. Please check your connection and retry.'), { code });
  }
  return error instanceof Error ? error : new Error(msg || 'Authentication failed.');
}

interface AuthState {
  authUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  token: string | null;
  
  initializeAuth: () => () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, extra: Partial<UserProfile>) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authUser: null,
  userProfile: null,
  loading: true,
  token: null,

  initializeAuth: () => {
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onIdTokenChanged(auth, async (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (user) {
        try {
          const token = await user.getIdToken();
          set({ authUser: user, token });
          
          // Real-time Firestore snapshot listener
          const userDocRef = doc(db, 'users', user.uid);
          unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const prevProfile = get().userProfile;
              const rawData = docSnap.data() as any;
              const xpVal = Number(rawData.xp ?? rawData.totalXp ?? 0);
              const computedLevel = calculateLevelFromXP(xpVal);
              const resolvedAvatar = resolveUserAvatar(rawData);

              const isEligible = computedLevel >= 3;

              const newProfile: UserProfile = {
                ...rawData,
                uid: docSnap.id || user.uid,
                photoURL: resolvedAvatar.url,
                equippedAvatar: rawData.equippedAvatar || resolvedAvatar.id,
                unlockedAvatars: (rawData.unlockedAvatars && rawData.unlockedAvatars.length > 0) ? rawData.unlockedAvatars : [resolvedAvatar.id],
                xp: xpVal,
                totalXp: xpVal,
                level: computedLevel,
                leaderboardEligible: isEligible
              };

              if (prevProfile && newProfile) {
                const prevXp = Number(prevProfile.xp ?? (prevProfile as any).totalXp ?? 0);
                const newXp = xpVal;
                if (newXp > prevXp) {
                  window.dispatchEvent(new CustomEvent('xp-earned', { detail: { amount: newXp - prevXp } }));
                }
                const prevCoins = prevProfile.coins || 0;
                const newCoins = newProfile.coins || 0;
                if (newCoins > prevCoins) {
                  window.dispatchEvent(new CustomEvent('coins-earned', { detail: { amount: newCoins - prevCoins } }));
                }
                const prevLevel = calculateLevelFromXP(prevXp);
                const newLvl = computedLevel;
                if (newLvl > prevLevel) {
                  window.dispatchEvent(new CustomEvent('level-up', {
                    detail: {
                      levelBefore: prevLevel,
                      levelAfter: newLvl,
                      level: newLvl,
                      earnedXp: newXp - prevXp
                    }
                  }));

                  if (newLvl >= 3 && prevLevel < 3) {
                    window.dispatchEvent(new CustomEvent('leaderboard-unlocked', {
                      detail: {
                        message: '🏆 Leaderboard Unlocked! You are now eligible to compete with other players.',
                        level: newLvl
                      }
                    }));
                  }
                }
              }
              set({ userProfile: newProfile, loading: false });
            }
          }, (err) => {
            console.error('Real-time profile listener error:', err);
          });
          
          // Verify on login to claim rewards asynchronously
          fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              if (data.loginRewardClaimed) {
                window.dispatchEvent(new CustomEvent('login-reward-claimed', { detail: data.loginRewardClaimed }));
              }
            }
          }).catch(err => {
            console.error('Asynchronous verify call error:', err);
          });
          
        } catch (error) {
          console.error('Error fetching user profile:', error);
          set({ authUser: user, loading: false });
        }
      } else {
        set({ authUser: null, userProfile: null, token: null, loading: false });
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      const token = await user.getIdToken();
      
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        set({ authUser: user, token, userProfile: data.profile as UserProfile, loading: false });
        if (data.loginRewardClaimed) {
          window.dispatchEvent(new CustomEvent('login-reward-claimed', { detail: data.loginRewardClaimed }));
        }
      } else {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          set({ authUser: user, token, userProfile: userDoc.data() as UserProfile, loading: false });
        } else {
          set({ authUser: user, token, userProfile: null, loading: false });
        }
      }
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  register: async (email, password, displayName, extra) => {
    set({ loading: true });
    let authCreatedUser: FirebaseUser | null = null;
    try {
      const current = auth.currentUser;
      if (current && current.email?.toLowerCase() === email.toLowerCase()) {
        authCreatedUser = current;
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        authCreatedUser = credential.user;
      }

      const token = await authCreatedUser.getIdToken(true);
      const defaultResolved = resolveUserAvatar({ uid: authCreatedUser.uid });

      try {
        const res = await fetch('/api/auth/register-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            displayName,
            email,
            college: extra.college || '',
            department: extra.department || '',
            year: extra.year || 1,
            dreamCompany: extra.dreamCompany || '',
            referredBy: (extra as any).referredBy
          })
        });

        if (res.ok) {
          const data = await res.json();
          set({ authUser: authCreatedUser, token, userProfile: data.profile as UserProfile, loading: false });
          return;
        }
      } catch {
        // Fall through to safe Firestore fallback
      }

      // Safe Firestore fallback: check existence first so we never send protected keys on an update
      const userDocRef = doc(db, 'users', authCreatedUser.uid);
      const existingSnap = await getDoc(userDocRef);
      if (existingSnap.exists()) {
        const safeUpdates: Record<string, any> = {
          college: extra.college || existingSnap.data()?.college || '',
          department: extra.department || existingSnap.data()?.department || '',
          year: extra.year || existingSnap.data()?.year || 1,
          dreamCompany: extra.dreamCompany || existingSnap.data()?.dreamCompany || '',
          displayName: displayName || existingSnap.data()?.displayName || 'Candidate'
        };
        await setDoc(userDocRef, safeUpdates, { merge: true });
        const merged = { ...existingSnap.data(), ...safeUpdates } as UserProfile;
        set({ authUser: authCreatedUser, token, userProfile: merged, loading: false });
      } else {
        const defaultProfile: UserProfile = {
          uid: authCreatedUser.uid,
          email,
          displayName,
          photoURL: defaultResolved.url,
          equippedAvatar: defaultResolved.id,
          unlockedAvatars: [defaultResolved.id],
          role: 'student',
          college: extra.college || '',
          department: extra.department || '',
          year: extra.year || 1,
          dreamCompany: extra.dreamCompany || '',
          skills: extra.skills || [],
          bio: extra.bio || '',
          xp: 0,
          coins: 100,
          level: 1,
          leaderboardEligible: false,
          battleRating: 1000,
          dailyStreak: 0,
          lastActiveDate: new Date().toISOString(),
          placementReadinessScore: 0,
          stats: {
            totalQuestionsSolved: 0,
            totalBattlesWon: 0,
            totalMockTests: 0
          },
          unlockedAchievements: [],
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, defaultProfile);
        set({ authUser: authCreatedUser, token, userProfile: defaultProfile, loading: false });
      }
    } catch (error: any) {
      set({ loading: false });
      if (authCreatedUser) {
        const mapped = mapAuthOrProfileError(error);
        const initErr = Object.assign(
          new Error(`Registration successful, but profile initialization failed: ${mapped.message}`),
          { code: 'PROFILE_INIT_FAILED' }
        );
        throw initErr;
      }
      throw mapAuthOrProfileError(error);
    }
  },

  loginWithGoogle: async () => {
    set({ loading: true });
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const user = credential.user;
      const token = await user.getIdToken();
      
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        set({ authUser: user, token, userProfile: data.profile as UserProfile, loading: false });
        if (data.loginRewardClaimed) {
          window.dispatchEvent(new CustomEvent('login-reward-claimed', { detail: data.loginRewardClaimed }));
        }
      } else {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const raw = userDoc.data() as any;
          const resolved = resolveUserAvatar(raw);
          set({ 
            authUser: user, 
            token, 
            userProfile: { ...raw, photoURL: resolved.url, equippedAvatar: raw.equippedAvatar || resolved.id, unlockedAvatars: raw.unlockedAvatars || [resolved.id] } as UserProfile, 
            loading: false 
          });
        } else {
          const defaultResolved = resolveUserAvatar({ uid: user.uid });
          const defaultProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'CrackPrep Student',
            photoURL: defaultResolved.url,
            equippedAvatar: defaultResolved.id,
            unlockedAvatars: [defaultResolved.id],
            role: 'student',
            college: '',
            department: '',
            year: 1,
            dreamCompany: '',
            skills: [],
            bio: '',
            xp: 0,
            coins: 100,
            level: 1,
            leaderboardEligible: false,
            battleRating: 1000,
            dailyStreak: 0,
            lastActiveDate: new Date().toISOString(),
            placementReadinessScore: 0,
            stats: {
              totalQuestionsSolved: 0,
              totalBattlesWon: 0,
              totalMockTests: 0
            },
            unlockedAchievements: [],
            createdAt: new Date().toISOString()
          };
          
          await setDoc(doc(db, 'users', user.uid), defaultProfile);
          set({ authUser: user, token, userProfile: defaultProfile, loading: false });
        }
      }
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await signOut(auth);
      set({ authUser: null, userProfile: null, token: null, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  updateProfile: async (updates) => {
    const { userProfile, authUser } = get();
    if (!authUser || !userProfile) throw new Error('Not authenticated');
    
    try {
      // Disallow client tampering with protected server-authoritative fields
      const sanitizedUpdates: Record<string, any> = { ...updates };
      delete sanitizedUpdates.role;
      delete sanitizedUpdates.coins;
      delete sanitizedUpdates.xp;
      delete sanitizedUpdates.totalXp;
      delete sanitizedUpdates.level;
      delete sanitizedUpdates.battleRating;
      delete sanitizedUpdates.leaderboardEligible;
      delete sanitizedUpdates.xpProgressionVersion;

      const xpVal = Number(userProfile.xp ?? (userProfile as any).totalXp ?? 0);
      const trustedLevel = calculateLevelFromXP(xpVal);
      const isEligible = trustedLevel >= 3;

      if (Object.keys(sanitizedUpdates).length > 0) {
        await setDoc(doc(db, 'users', authUser.uid), sanitizedUpdates, { merge: true });
      }

      const updatedProfile = {
        ...userProfile,
        ...sanitizedUpdates,
        level: trustedLevel,
        leaderboardEligible: isEligible
      };

      set({ userProfile: updatedProfile });
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }
}));
