import React, { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaCoins, 
  FaStar, 
  FaMagnifyingGlass, 
  FaCircleCheck, 
  FaUser, 
  FaGraduationCap, 
  FaBriefcase, 
  FaGlobe, 
  FaChevronDown, 
  FaChevronUp
} from 'react-icons/fa6';
import { COSMETICS_CATALOG, getRingClass, getBackgroundClass, getFrameClass, getRarityColor } from '../config/cosmetics';
import type { CosmeticItem } from '../config/cosmetics';
import type { UserProfile } from '../types';
import { getAvatarImageUrl } from '../utils/avatarResolver';

export const Personalization: React.FC = () => {
  const { userProfile, token } = useAuthStore();
  const navigate = useNavigate();
  const [equippingId, setEquippingId] = useState<string | null>(null);
  const [loadingFavoriteId, setLoadingFavoriteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const location = useLocation();
  const queryTab = useMemo(() => new URLSearchParams(location.search).get('tab'), [location.search]);

  // Customization Tabs
  const [selectedCategory, setSelectedCategory] = useState<string>(queryTab || 'edit_profile');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [favoriteOnly, setFavoriteOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('favorites');

  // Preview state (defaults to currently equipped cosmetics)
  const [previewAvatar, setPreviewAvatar] = useState<string>(userProfile?.equippedAvatar || 'avatar_starter');
  const [previewRing, setPreviewRing] = useState<string>(userProfile?.equippedRing || '');
  const [previewFrame, setPreviewFrame] = useState<string>(userProfile?.equippedFrame || '');
  const [previewBg, setPreviewBg] = useState<string>(userProfile?.equippedBackground || '');
  const [previewTitle, setPreviewTitle] = useState<string>(userProfile?.equippedTitle || '');

  // Edit Profile States
  const [editDisplayName, setEditDisplayName] = useState<string>(userProfile?.displayName || '');
  const [editUsername, setEditUsername] = useState<string>(userProfile?.username || '');
  const [editBio, setEditBio] = useState<string>(userProfile?.bio || '');
  const [editCollege, setEditCollege] = useState<string>(userProfile?.college || '');
  const [editDegree, setEditDegree] = useState<string>(userProfile?.degree || '');
  const [editDepartment, setEditDepartment] = useState<string>(userProfile?.department || '');
  const [editYear, setEditYear] = useState<number>(userProfile?.year || 1);
  const [editGraduationYear, setEditGraduationYear] = useState<string>(userProfile?.graduationYear || '');
  const [editSemester, setEditSemester] = useState<string>(userProfile?.semester || '');
  const [editCareerGoal, setEditCareerGoal] = useState<string>(userProfile?.careerGoal || '');
  const [editDreamCompany, setEditDreamCompany] = useState<string>(userProfile?.dreamCompany || '');
  const [editPreferredRole, setEditPreferredRole] = useState<string>(userProfile?.preferredRole || '');
  const [editCountry, setEditCountry] = useState<string>(userProfile?.country || '');
  const [editState, setEditState] = useState<string>(userProfile?.state || '');
  const [editCity, setEditCity] = useState<string>(userProfile?.city || '');
  const [editLinkedin, setEditLinkedin] = useState<string>(userProfile?.linkedin || '');
  const [editGithub, setEditGithub] = useState<string>(userProfile?.github || '');
  const [editPortfolio, setEditPortfolio] = useState<string>(userProfile?.portfolio || '');
  const [editLeetcode, setEditLeetcode] = useState<string>(userProfile?.leetcode || '');
  const [editHackerrank, setEditHackerrank] = useState<string>(userProfile?.hackerrank || '');
  const [editCodeforces, setEditCodeforces] = useState<string>(userProfile?.codeforces || '');

  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState<boolean>(true);

  // Collapsible cards state
  const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({
    personal: true,
    academic: true,
    career: true,
    socials: true
  });

  const toggleCard = (card: string) => {
    setExpandedCards(prev => ({ ...prev, [card]: !prev[card] }));
  };

  useEffect(() => {
    if (queryTab) {
      setSelectedCategory(queryTab);
    }
  }, [queryTab]);

  useEffect(() => {
    if (userProfile) {
      setEditDisplayName(userProfile.displayName || '');
      setEditUsername(userProfile.username || '');
      setEditBio(userProfile.bio || '');
      setEditCollege(userProfile.college || '');
      setEditDegree(userProfile.degree || '');
      setEditDepartment(userProfile.department || '');
      setEditYear(userProfile.year || 1);
      setEditGraduationYear(userProfile.graduationYear || '');
      setEditSemester(userProfile.semester || '');
      setEditCareerGoal(userProfile.careerGoal || '');
      setEditDreamCompany(userProfile.dreamCompany || '');
      setEditPreferredRole(userProfile.preferredRole || '');
      setEditCountry(userProfile.country || '');
      setEditState(userProfile.state || '');
      setEditCity(userProfile.city || '');
      setEditLinkedin(userProfile.linkedin || '');
      setEditGithub(userProfile.github || '');
      setEditPortfolio(userProfile.portfolio || '');
      setEditLeetcode(userProfile.leetcode || '');
      setEditHackerrank(userProfile.hackerrank || '');
      setEditCodeforces(userProfile.codeforces || '');
      
      if (userProfile.equippedAvatar) setPreviewAvatar(userProfile.equippedAvatar);
      if (userProfile.equippedRing !== undefined) setPreviewRing(userProfile.equippedRing || '');
      if (userProfile.equippedFrame !== undefined) setPreviewFrame(userProfile.equippedFrame || '');
      if (userProfile.equippedBackground !== undefined) setPreviewBg(userProfile.equippedBackground || '');
      if (userProfile.equippedTitle !== undefined) setPreviewTitle(userProfile.equippedTitle || '');
    }
  }, [userProfile]);

  const isProfileDirty = useMemo(() => {
    if (!userProfile) return false;
    return (
      editDisplayName !== (userProfile.displayName || '') ||
      editUsername !== (userProfile.username || '') ||
      editBio !== (userProfile.bio || '') ||
      editCollege !== (userProfile.college || '') ||
      editDegree !== (userProfile.degree || '') ||
      editDepartment !== (userProfile.department || '') ||
      editYear !== (userProfile.year || 1) ||
      editGraduationYear !== (userProfile.graduationYear || '') ||
      editSemester !== (userProfile.semester || '') ||
      editCareerGoal !== (userProfile.careerGoal || '') ||
      editDreamCompany !== (userProfile.dreamCompany || '') ||
      editPreferredRole !== (userProfile.preferredRole || '') ||
      editCountry !== (userProfile.country || '') ||
      editState !== (userProfile.state || '') ||
      editCity !== (userProfile.city || '') ||
      editLinkedin !== (userProfile.linkedin || '') ||
      editGithub !== (userProfile.github || '') ||
      editPortfolio !== (userProfile.portfolio || '') ||
      editLeetcode !== (userProfile.leetcode || '') ||
      editHackerrank !== (userProfile.hackerrank || '') ||
      editCodeforces !== (userProfile.codeforces || '')
    );
  }, [
    editDisplayName, editUsername, editBio,
    editCollege, editDegree, editDepartment, editYear, editGraduationYear, editSemester,
    editCareerGoal, editDreamCompany, editPreferredRole,
    editCountry, editState, editCity,
    editLinkedin, editGithub, editPortfolio, editLeetcode, editHackerrank, editCodeforces,
    userProfile
  ]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProfileDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
        return 'You have unsaved changes.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isProfileDirty]);

  const completionDetails = useMemo(() => {
    const fields = [
      { key: 'displayName', value: editDisplayName },
      { key: 'username', value: editUsername },
      { key: 'bio', value: editBio },
      { key: 'college', value: editCollege },
      { key: 'degree', value: editDegree },
      { key: 'department', value: editDepartment },
      { key: 'graduationYear', value: editGraduationYear },
      { key: 'semester', value: editSemester },
      { key: 'careerGoal', value: editCareerGoal },
      { key: 'dreamCompany', value: editDreamCompany },
      { key: 'preferredRole', value: editPreferredRole },
      { key: 'country', value: editCountry },
      { key: 'state', value: editState },
      { key: 'city', value: editCity },
      { key: 'github', value: editGithub },
      { key: 'linkedin', value: editLinkedin },
      { key: 'portfolio', value: editPortfolio }
    ];

    let completedCount = 0;
    const suggestionsList: string[] = [];

    const hasAvatar = previewAvatar || userProfile?.photoURL;
    if (hasAvatar) {
      completedCount++;
    } else {
      suggestionsList.push('Select a profile avatar.');
    }

    fields.forEach(field => {
      if (field.value !== undefined && field.value !== null && String(field.value).trim() !== '') {
        completedCount++;
      } else {
        if (field.key === 'github') suggestionsList.push('Add GitHub handle.');
        else if (field.key === 'linkedin') suggestionsList.push('Add LinkedIn URL.');
        else if (field.key === 'portfolio') suggestionsList.push('Add Portfolio URL.');
        else if (['college', 'degree', 'department'].includes(field.key) && !suggestionsList.includes('Complete academic details.')) {
          suggestionsList.push('Complete academic details.');
        } else if (['careerGoal', 'dreamCompany', 'preferredRole'].includes(field.key) && !suggestionsList.includes('Complete career goals.')) {
          suggestionsList.push('Complete career goals.');
        }
      }
    });

    const percentage = Math.round((completedCount / (fields.length + 1)) * 100);
    return { percentage, suggestions: suggestionsList };
  }, [
    editDisplayName, editUsername, editBio,
    editCollege, editDegree, editDepartment, editGraduationYear, editSemester,
    editCareerGoal, editDreamCompany, editPreferredRole,
    editCountry, editState, editCity,
    editLinkedin, editGithub, editPortfolio, previewAvatar, userProfile
  ]);

  const handleSaveProfile = async (silent = false) => {
    if (!editDisplayName.trim() || editDisplayName.length < 2 || editDisplayName.length > 50) {
      if (!silent) setErrorMessage('Full Name is required and must be between 2 and 50 characters.');
      return;
    }

    if (editUsername.trim()) {
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(editUsername.trim())) {
        if (!silent) setErrorMessage('Username can only contain letters, numbers, and underscores.');
        return;
      }
    }

    if (editBio.length > 200) {
      if (!silent) setErrorMessage('Bio cannot exceed 200 characters.');
      return;
    }

    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;

    if (editPortfolio.trim() && !urlRegex.test(editPortfolio.trim())) {
      if (!silent) setErrorMessage('Portfolio must be a valid URL.');
      return;
    }

    if (editGithub.trim()) {
      const githubUrlRegex = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/i;
      const githubHandleRegex = /^[a-zA-Z0-9_-]+$/;
      if (!githubUrlRegex.test(editGithub.trim()) && !githubHandleRegex.test(editGithub.trim())) {
        if (!silent) setErrorMessage('GitHub must be a valid profile URL or username.');
        return;
      }
    }

    if (editLinkedin.trim()) {
      const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/i;
      if (!linkedinRegex.test(editLinkedin.trim())) {
        if (!silent) setErrorMessage('LinkedIn must be a valid profile URL.');
        return;
      }
    }

    if (editGraduationYear.trim()) {
      const gradYearNum = Number(editGraduationYear);
      if (isNaN(gradYearNum) || gradYearNum < 1900 || gradYearNum > 2100) {
        if (!silent) setErrorMessage('Graduation Year must be a valid year.');
        return;
      }
    }

    if (!silent) {
      setSavingProfile(true);
      setErrorMessage(null);
      setSuccessMessage(null);
    }

    try {
      const res = await fetch('/api/auth/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: editDisplayName,
          username: editUsername,
          bio: editBio,
          college: editCollege,
          degree: editDegree,
          department: editDepartment,
          year: editYear,
          graduationYear: editGraduationYear,
          semester: editSemester,
          careerGoal: editCareerGoal,
          dreamCompany: editDreamCompany,
          preferredRole: editPreferredRole,
          country: editCountry,
          state: editState,
          city: editCity,
          linkedin: editLinkedin,
          github: editGithub,
          portfolio: editPortfolio,
          leetcode: editLeetcode,
          hackerrank: editHackerrank,
          codeforces: editCodeforces
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save changes.');
      }

      const data = await res.json();
      // Relying on onSnapshot for state sync

      if (silent) {
        console.log('[AUTO-SAVE] Profile auto-saved successfully.');
      } else {
        let msg = 'Profile updated successfully.';
        if (data.xpRewardGranted) {
          msg += ` (+20 XP Profile Reward Claimed!)`;
        }
        if (data.leveledUp) {
          msg += ` Leveled Up to Level ${data.newLevel}!`;
        }
        setSuccessMessage(msg);
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) {
        setErrorMessage(err.message || 'Failed to save profile changes.');
      }
    } finally {
      if (!silent) {
        setSavingProfile(false);
      }
    }
  };

  useEffect(() => {
    if (!isAutoSaveEnabled || !isProfileDirty || savingProfile) return;

    const timer = setInterval(() => {
      handleSaveProfile(true);
    }, 30000);

    return () => clearInterval(timer);
  }, [
    isAutoSaveEnabled, isProfileDirty, savingProfile,
    editDisplayName, editUsername, editBio,
    editCollege, editDegree, editDepartment, editYear, editGraduationYear, editSemester,
    editCareerGoal, editDreamCompany, editPreferredRole,
    editCountry, editState, editCity,
    editLinkedin, editGithub, editPortfolio, editLeetcode, editHackerrank, editCodeforces
  ]);

  if (!userProfile) return null;

  const getAvatarUrl = (visual: string) => {
    return getAvatarImageUrl(visual, visual);
  };

  const isOwned = (item: CosmeticItem) => {
    if (item.isFree || item.cost === 0) return true;
    let ownedList: string[] = [];
    if (item.category === 'avatar') ownedList = userProfile.unlockedAvatars || [];
    else if (item.category === 'ring') ownedList = userProfile.unlockedRings || [];
    else if (item.category === 'frame') ownedList = userProfile.unlockedFrames || [];
    else if (item.category === 'background') ownedList = userProfile.unlockedBackgrounds || [];
    else if (item.category === 'title') ownedList = userProfile.unlockedTitles || [];
    else if (item.category === 'theme') ownedList = userProfile.unlockedThemes || [];
    else if (item.category === 'emote') ownedList = userProfile.unlockedEmotes || [];
    else if (item.category === 'entrance') ownedList = userProfile.unlockedEntrances || [];
    else if (item.category === 'victory') ownedList = userProfile.unlockedVictories || [];
    else if (item.category === 'sticker') ownedList = userProfile.unlockedStickers || [];
    return ownedList.includes(item.id);
  };

  const isEquipped = (item: CosmeticItem) => {
    if (item.category === 'avatar') return userProfile.equippedAvatar === item.id;
    if (item.category === 'ring') return userProfile.equippedRing === item.id;
    if (item.category === 'frame') return userProfile.equippedFrame === item.id;
    if (item.category === 'background') return userProfile.equippedBackground === item.id;
    if (item.category === 'title') return userProfile.equippedTitle === item.id;
    if (item.category === 'theme') return userProfile.equippedTheme === item.id;
    if (item.category === 'emote') return userProfile.equippedEmote === item.id;
    if (item.category === 'entrance') return userProfile.equippedEntrance === item.id;
    if (item.category === 'victory') return userProfile.equippedVictory === item.id;
    return false;
  };

  const handlePreviewItem = (item: CosmeticItem) => {
    if (item.category === 'avatar') setPreviewAvatar(item.id);
    else if (item.category === 'ring') setPreviewRing(item.id);
    else if (item.category === 'frame') setPreviewFrame(item.id);
    else if (item.category === 'background') setPreviewBg(item.id);
    else if (item.category === 'title') setPreviewTitle(item.id);
  };

  const ownedItems = useMemo(() => {
    let items = COSMETICS_CATALOG.filter(item => item.category === selectedCategory && isOwned(item));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query));
    }

    if (rarityFilter !== 'all') {
      items = items.filter(item => item.rarity === rarityFilter);
    }

    if (favoriteOnly) {
      items = items.filter(item => {
        if (!userProfile.favoriteItems) return false;
        const key = `${item.category}s` as keyof typeof userProfile.favoriteItems;
        const list = userProfile.favoriteItems[key] || [];
        return list.includes(item.id);
      });
    }

    items.sort((a, b) => {
      if (sortBy === 'favorites') {
        const getFavVal = (x: CosmeticItem) => {
          if (!userProfile.favoriteItems) return 0;
          const k = `${x.category}s` as keyof typeof userProfile.favoriteItems;
          const l = userProfile.favoriteItems[k] || [];
          return l.includes(x.id) ? 1 : 0;
        };
        return getFavVal(b) - getFavVal(a);
      }
      if (sortBy === 'newest') {
        const idxA = COSMETICS_CATALOG.findIndex(x => x.id === a.id);
        const idxB = COSMETICS_CATALOG.findIndex(x => x.id === b.id);
        return idxB - idxA;
      }
      if (sortBy === 'oldest') {
        const idxA = COSMETICS_CATALOG.findIndex(x => x.id === a.id);
        const idxB = COSMETICS_CATALOG.findIndex(x => x.id === b.id);
        return idxA - idxB;
      }
      if (sortBy === 'rarity') {
        const weights = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, secret: 6 };
        return weights[b.rarity] - weights[a.rarity];
      }
      if (sortBy === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return items;
  }, [selectedCategory, searchQuery, rarityFilter, favoriteOnly, sortBy, userProfile]);

  const handleEquipItem = async (item: CosmeticItem) => {
    if (!isOwned(item)) {
      setErrorMessage("You do not own this cosmetic item!");
      return;
    }

    setEquippingId(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    const previousProfile = { ...userProfile };
    const category = item.category;
    const targetField = `equipped${category.charAt(0).toUpperCase() + category.slice(1)}` as keyof UserProfile;
    
    const updatedProfile = {
      ...userProfile,
      [targetField]: item.id
    };

    if (category === 'avatar') {
      updatedProfile.photoURL = getAvatarUrl(item.visual);
    }

    useAuthStore.setState({ userProfile: updatedProfile });

    try {
      const res = await fetch('/api/auth/profile/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category: item.category, itemId: item.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to equip cosmetic.');
      }
      // Relying on onSnapshot for state sync
      // Relying on onSnapshot for state sync
      setSuccessMessage(`${item.name} equipped.`);
    } catch (err: any) {
      console.error(err);
      useAuthStore.setState({ userProfile: previousProfile });
      setErrorMessage(err.message || 'Equip operation failed.');
    } finally {
      setEquippingId(null);
    }
  };

  const handleUnequipItem = async (item: CosmeticItem) => {
    setEquippingId(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    const previousProfile = { ...userProfile };
    const category = item.category;
    const targetField = `equipped${category.charAt(0).toUpperCase() + category.slice(1)}` as keyof UserProfile;
    
    const updatedProfile = {
      ...userProfile,
      [targetField]: null
    };

    if (category === 'avatar') {
      updatedProfile.photoURL = getAvatarImageUrl('starter', 'starter');
    }

    useAuthStore.setState({ userProfile: updatedProfile });

    try {
      const res = await fetch('/api/auth/profile/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category: item.category, itemId: null })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to unequip cosmetic.');
      }
      await res.json();
      // Relying on onSnapshot for state sync
      setSuccessMessage(`${item.name} unequipped.`);
    } catch (err: any) {
      console.error(err);
      useAuthStore.setState({ userProfile: previousProfile });
      setErrorMessage(err.message || 'Unequip operation failed.');
    } finally {
      setEquippingId(null);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, item: CosmeticItem) => {
    e.stopPropagation();
    if (!isOwned(item)) return;

    setLoadingFavoriteId(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    const previousProfile = { ...userProfile };
    const favoriteItems = { ...(userProfile.favoriteItems || {}) };
    const key = `${item.category}s` as keyof typeof favoriteItems;
    let list = [...(favoriteItems[key] || [])];

    let isAdding = false;
    if (list.includes(item.id)) {
      list = list.filter((id: string) => id !== item.id);
    } else {
      list.push(item.id);
      isAdding = true;
    }
    favoriteItems[key] = list;

    const updatedProfile = {
      ...userProfile,
      favoriteItems
    };

    useAuthStore.setState({ userProfile: updatedProfile });

    try {
      const res = await fetch('/api/auth/profile/favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemId: item.id })
      });
      if (!res.ok) throw new Error();
      await res.json();
      // Relying on onSnapshot for state sync
      setSuccessMessage(isAdding ? `${item.name} added to favorites.` : `${item.name} removed from favorites.`);
    } catch (err) {
      useAuthStore.setState({ userProfile: previousProfile });
      setErrorMessage('Favorite toggle failed.');
    } finally {
      setLoadingFavoriteId(null);
    }
  };

  const previewTitleItem = COSMETICS_CATALOG.find(i => i.id === previewTitle);
  const displayTitle = previewTitleItem ? previewTitleItem.visual : '';

  const previewAvatarItem = COSMETICS_CATALOG.find(i => i.id === previewAvatar);
  const displayAvatarSeed = previewAvatarItem ? previewAvatarItem.visual : previewAvatar;

  const readinessScore = Number(userProfile.placementReadinessScore ?? 60);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-fade-in">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/profile')}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <FaArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Profile & Customization Locker</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Edit candidate information, academic credentials, and customize your public loadout.</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/store')}
          className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <FaCoins className="w-3.5 h-3.5 text-amber-500" />
          <span>Rewards Store</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2">
          <span>✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Locker Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column (4/12): Live preview loadout frame */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidate Card Preview</h2>

            {/* Profile preview template with responsive styles */}
            <div className={`p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-all ${getBackgroundClass(previewBg)} ${getFrameClass(previewFrame)}`}>
              <div className="flex flex-col items-center text-center space-y-3">
                
                {/* Ring outline wrapper */}
                <div className="relative">
                  <div className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 transition-all ${getRingClass(previewRing)}`}>
                    <img 
                      src={getAvatarUrl(displayAvatarSeed)} 
                      alt="Preview Avatar" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                    {userProfile.level || 1}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-[200px]">
                    {editDisplayName.trim() ? editDisplayName : (userProfile.displayName || 'Candidate')}
                  </h3>
                  {displayTitle && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-semibold">
                      {displayTitle}
                    </span>
                  )}
                </div>

                {/* Grid stats details */}
                <div className="grid grid-cols-2 gap-2.5 w-full pt-3 border-t border-slate-200 dark:border-slate-800 text-left">
                  <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Rating</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-bold mt-0.5">{userProfile.battleRating || 1200} Elo</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Readiness</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">{readinessScore}%</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
              Equipped items are visible to recruiters and opponents in Battle Arena & Leaderboards.
            </p>
          </div>
        </div>

        {/* Right column (8/12): Tabs, inventory items, filters */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Locker filter container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-4 shadow-xs">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
              {[
                { id: 'edit_profile', label: 'Candidate Profile' },
                { id: 'avatar', label: 'Avatars' },
                { id: 'ring', label: 'Rings' },
                { id: 'frame', label: 'Frames' },
                { id: 'background', label: 'Backgrounds' },
                { id: 'title', label: 'Titles' },
                { id: 'theme', label: 'Themes' },
                { id: 'emote', label: 'Emotes' },
                { id: 'entrance', label: 'Entrances' },
                { id: 'victory', label: 'Victories' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    selectedCategory === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {selectedCategory !== 'edit_profile' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div className="relative">
                  <FaMagnifyingGlass className="absolute left-3.5 top-3 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Search cosmetics..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                  />
                </div>

                <div>
                  <select
                    value={rarityFilter}
                    onChange={e => setRarityFilter(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                  >
                    <option value="all">All Rarities</option>
                    <option value="common">Common</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>

                <div>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                  >
                    <option value="favorites">Favorites First</option>
                    <option value="newest">Newest</option>
                    <option value="rarity">Rarity</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                </div>

                <button
                  onClick={() => setFavoriteOnly(!favoriteOnly)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    favoriteOnly
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FaStar className={`w-3.5 h-3.5 ${favoriteOnly ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span>Favorites Only</span>
                </button>
              </div>
            )}
          </div>

          {selectedCategory === 'edit_profile' ? (
            <div className="space-y-5">
              
              {/* Profile Completion Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1.5 flex-1 w-full">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-900 dark:text-white">
                      <span>Profile Completeness</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{completionDetails.percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300 rounded-full" 
                        style={{ width: `${completionDetails.percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <input 
                      type="checkbox" 
                      id="autosave"
                      checked={isAutoSaveEnabled} 
                      onChange={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                      className="w-4 h-4 rounded-sm border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer" 
                    />
                    <label htmlFor="autosave" className="cursor-pointer select-none font-medium">Auto-save changes</label>
                  </div>
                </div>

                {completionDetails.suggestions.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 space-y-1.5 text-blue-900 dark:text-blue-300">
                    <p className="text-xs font-semibold">Recommendations for +20 XP Profile Reward:</p>
                    <ul className="text-xs space-y-1 list-disc pl-4 text-blue-800 dark:text-blue-300">
                      {completionDetails.suggestions.slice(0, 3).map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Collapsible Sections */}
              <div className="space-y-4">
                
                {/* 1. Personal Information */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <button 
                    type="button"
                    onClick={() => toggleCard('personal')}
                    className="w-full flex justify-between items-center p-4.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800 cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <FaUser className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Personal Information</span>
                    </div>
                    {expandedCards.personal ? <FaChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <FaChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  {expandedCards.personal && (
                    <div className="p-5 sm:p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Full Name *</label>
                          <input 
                            type="text"
                            value={editDisplayName} 
                            onChange={e => setEditDisplayName(e.target.value)} 
                            maxLength={50}
                            placeholder="e.g. Loki Cadet"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Username</label>
                          <input 
                            type="text"
                            value={editUsername} 
                            onChange={e => setEditUsername(e.target.value)} 
                            maxLength={30}
                            placeholder="e.g. loki_dev"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Bio / Summary (Max 200 chars)</label>
                        <textarea 
                          value={editBio} 
                          onChange={e => setEditBio(e.target.value)} 
                          maxLength={200}
                          rows={3}
                          placeholder="Tell recruiters and peers about your technical focus..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs resize-none focus:outline-hidden focus:border-blue-600"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">City</label>
                          <input 
                            type="text"
                            value={editCity} 
                            onChange={e => setEditCity(e.target.value)} 
                            placeholder="e.g. Bangalore"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">State</label>
                          <input 
                            type="text"
                            value={editState} 
                            onChange={e => setEditState(e.target.value)} 
                            placeholder="e.g. Karnataka"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Country</label>
                          <input 
                            type="text"
                            value={editCountry} 
                            onChange={e => setEditCountry(e.target.value)} 
                            placeholder="e.g. India"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Academic Information */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <button 
                    type="button"
                    onClick={() => toggleCard('academic')}
                    className="w-full flex justify-between items-center p-4.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800 cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <FaGraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Academic Details</span>
                    </div>
                    {expandedCards.academic ? <FaChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <FaChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  {expandedCards.academic && (
                    <div className="p-5 sm:p-6 space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">College / University</label>
                        <input 
                          type="text"
                          value={editCollege} 
                          onChange={e => setEditCollege(e.target.value)} 
                          placeholder="e.g. Indian Institute of Technology"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Degree</label>
                          <input 
                            type="text"
                            value={editDegree} 
                            onChange={e => setEditDegree(e.target.value)} 
                            placeholder="e.g. B.Tech / B.E."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Department / Branch</label>
                          <input 
                            type="text"
                            value={editDepartment} 
                            onChange={e => setEditDepartment(e.target.value)} 
                            placeholder="e.g. Computer Science & Engineering"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Year of Study</label>
                          <select
                            value={editYear}
                            onChange={e => setEditYear(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          >
                            {[1, 2, 3, 4, 5].map(y => (
                              <option key={y} value={y}>Year {y}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Current Semester</label>
                          <input 
                            type="text"
                            value={editSemester} 
                            onChange={e => setEditSemester(e.target.value)} 
                            placeholder="e.g. 7th"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Graduation Year</label>
                          <input 
                            type="text"
                            value={editGraduationYear} 
                            onChange={e => setEditGraduationYear(e.target.value)} 
                            placeholder="e.g. 2026"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Career Goals */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <button 
                    type="button"
                    onClick={() => toggleCard('career')}
                    className="w-full flex justify-between items-center p-4.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800 cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <FaBriefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Career Objectives</span>
                    </div>
                    {expandedCards.career ? <FaChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <FaChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  {expandedCards.career && (
                    <div className="p-5 sm:p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Career Goal</label>
                          <input 
                            type="text"
                            value={editCareerGoal} 
                            onChange={e => setEditCareerGoal(e.target.value)} 
                            placeholder="e.g. Software Development Engineer"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Dream Company</label>
                          <input 
                            type="text"
                            value={editDreamCompany} 
                            onChange={e => setEditDreamCompany(e.target.value)} 
                            placeholder="e.g. Google / Microsoft / Amazon"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Preferred Role</label>
                          <input 
                            type="text"
                            value={editPreferredRole} 
                            onChange={e => setEditPreferredRole(e.target.value)} 
                            placeholder="e.g. Full Stack Developer"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Social & Coding Profiles */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <button 
                    type="button"
                    onClick={() => toggleCard('socials')}
                    className="w-full flex justify-between items-center p-4.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800 cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <FaGlobe className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Social & Coding Links</span>
                    </div>
                    {expandedCards.socials ? <FaChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <FaChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  {expandedCards.socials && (
                    <div className="p-5 sm:p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">LinkedIn Profile URL</label>
                          <input 
                            type="text"
                            value={editLinkedin} 
                            onChange={e => setEditLinkedin(e.target.value)} 
                            placeholder="https://linkedin.com/in/username"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">GitHub Profile or Username</label>
                          <input 
                            type="text"
                            value={editGithub} 
                            onChange={e => setEditGithub(e.target.value)} 
                            placeholder="username"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Portfolio Website</label>
                          <input 
                            type="text"
                            value={editPortfolio} 
                            onChange={e => setEditPortfolio(e.target.value)} 
                            placeholder="https://myportfolio.com"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">LeetCode Username</label>
                          <input 
                            type="text"
                            value={editLeetcode} 
                            onChange={e => setEditLeetcode(e.target.value)} 
                            placeholder="username"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">HackerRank Username</label>
                          <input 
                            type="text"
                            value={editHackerrank} 
                            onChange={e => setEditHackerrank(e.target.value)} 
                            placeholder="username"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Codeforces Handle</label>
                          <input 
                            type="text"
                            value={editCodeforces} 
                            onChange={e => setEditCodeforces(e.target.value)} 
                            placeholder="handle"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Form Action Controls */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isProfileDirty && !window.confirm('Discard unsaved changes?')) return;
                    navigate('/profile');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => handleSaveProfile(false)}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>

            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {ownedItems.map(item => {
                const active = isEquipped(item);
                const previewing = (item.category === 'avatar' && previewAvatar === item.id) ||
                                   (item.category === 'ring' && previewRing === item.id) ||
                                   (item.category === 'frame' && previewFrame === item.id) ||
                                   (item.category === 'background' && previewBg === item.id) ||
                                   (item.category === 'title' && previewTitle === item.id);

                const isFavorite = userProfile.favoriteItems &&
                                   userProfile.favoriteItems[`${item.category}s` as keyof typeof userProfile.favoriteItems]?.includes(item.id);

                const favoriteLoading = loadingFavoriteId === item.id;
                const equipLoading = equippingId === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => handlePreviewItem(item)}
                    className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 transition-all duration-150 flex flex-col justify-between gap-3 relative cursor-pointer shadow-xs ${
                      previewing 
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={(e) => handleToggleFavorite(e, item)}
                      disabled={favoriteLoading}
                      className="absolute top-3 right-3 z-10 text-slate-300 dark:text-slate-600 hover:text-amber-400 dark:hover:text-amber-400 transition-colors p-1 cursor-pointer"
                      title="Favorite"
                    >
                      <FaStar className={`w-3.5 h-3.5 ${isFavorite ? 'text-amber-400 dark:text-amber-400' : ''}`} />
                    </button>

                    <div className="flex flex-col items-center justify-center text-center space-y-2.5 pt-1">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                        {item.category === 'avatar' && (
                          <img src={getAvatarUrl(item.visual)} alt={item.name} className="w-full h-full object-cover" />
                        )}
                        {item.category === 'ring' && (
                          <div className={`w-11 h-11 rounded-full border bg-white dark:bg-slate-900 ${getRingClass(item.id)}`} />
                        )}
                        {item.category === 'background' && (
                          <div className={`w-11 h-11 rounded-lg border ${getBackgroundClass(item.id)}`} />
                        )}
                        {item.category === 'frame' && (
                          <div className={`w-11 h-11 border ${getFrameClass(item.id)}`} />
                        )}
                        {item.category === 'title' && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">TITLE</span>
                        )}
                        {item.category === 'emote' && (
                          <span className="text-2xl">{item.visual}</span>
                        )}
                        {item.category === 'sticker' && (
                          <span className="text-2xl">{item.visual}</span>
                        )}
                        {item.category === 'theme' && (
                          <span className="text-xl">🎨</span>
                        )}
                      </div>

                      <div className="w-full min-w-0">
                        <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.name}</h3>
                        <span className={`inline-block text-[10px] font-semibold uppercase mt-0.5 px-2 py-0.5 rounded-md ${getRarityColor(item.rarity)}`}>
                          {item.rarity}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                      {active ? (
                        <button
                          disabled={equipLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnequipItem(item);
                          }}
                          className="w-full py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FaCircleCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Equipped</span>
                        </button>
                      ) : (
                        <button
                          disabled={equipLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEquipItem(item);
                          }}
                          className="w-full py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                        >
                          {equipLoading ? 'Equipping...' : 'Equip'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {ownedItems.length === 0 && (
                <div className="col-span-full py-12 text-center space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No owned items in this category yet.</p>
                  <button
                    onClick={() => navigate('/store')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    Visit Rewards Store
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Personalization;
