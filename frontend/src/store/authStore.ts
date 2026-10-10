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

              const newProfile: UserProfile = {
                ...rawData,
                photoURL: resolvedAvatar.url,
                equippedAvatar: rawData.equippedAvatar || resolvedAvatar.id,
                unlockedAvatars: (rawData.unlockedAvatars && rawData.unlockedAvatars.length > 0) ? rawData.unlockedAvatars : [resolvedAvatar.id],
                xp: xpVal,
                level: computedLevel
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
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      const token = await user.getIdToken();
      const defaultResolved = resolveUserAvatar({ uid: user.uid });
      
      const defaultProfile: UserProfile = {
        uid: user.uid,
        email: email,
        displayName: displayName,
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
    } catch (error) {
      set({ loading: false });
      throw error;
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
      const updatedProfile = { ...userProfile, ...updates };
      await setDoc(doc(db, 'users', authUser.uid), updatedProfile, { merge: true });
      set({ userProfile: updatedProfile });
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }
}));
