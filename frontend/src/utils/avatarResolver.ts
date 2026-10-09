import { COSMETICS_CATALOG } from '../config/cosmetics';
import type { CosmeticItem } from '../config/cosmetics';
import type { UserProfile } from '../types';

export interface ResolvedAvatar {
  id: string;
  name: string;
  url: string;
  visual: string;
  isFree: boolean;
}

export const SYSTEM_DEFAULT_AVATAR_ID = 'avatar_starter';
export const SYSTEM_DEFAULT_AVATAR_VISUAL = 'starter';

/**
 * Returns a guaranteed valid image URL for a given visual identifier or seed.
 */
export function getAvatarImageUrl(visual?: string | null, seed?: string | null): string {
  if (visual && (visual.startsWith('http://') || visual.startsWith('https://') || visual.startsWith('data:'))) {
    return visual;
  }
  const effectiveSeed = visual || seed || SYSTEM_DEFAULT_AVATAR_VISUAL;
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(effectiveSeed)}`;
}

/**
 * Client unified Avatar Resolver following authoritative hierarchy:
 * 1. User's currently equipped avatar (from catalog ID e.g. 'avatar_samurai' or visual name)
 * 2. Pre-resolved photoURL or avatar URL
 * 3. User's owned avatar (first valid active owned avatar in catalog)
 * 4. Available active free starter avatar
 * 5. System default fallback avatar
 */
export function resolveUserAvatar(
  user?: Partial<UserProfile> | any,
  catalog: CosmeticItem[] = COSMETICS_CATALOG
): ResolvedAvatar {
  if (!user) {
    return {
      id: SYSTEM_DEFAULT_AVATAR_ID,
      name: 'Starter Cadet',
      url: getAvatarImageUrl(SYSTEM_DEFAULT_AVATAR_VISUAL),
      visual: SYSTEM_DEFAULT_AVATAR_VISUAL,
      isFree: true
    };
  }

  const avatarCatalog = catalog.filter(i => i.category === 'avatar' && (i.isActive !== false));

  // 1. Check user's equipped avatar (by catalog ID or visual key)
  const equippedId = user.equippedAvatar || user.equippedAvatarId;
  if (equippedId && typeof equippedId === 'string') {
    const item = avatarCatalog.find(i => i.id === equippedId || i.visual === equippedId);
    if (item) {
      return {
        id: item.id,
        name: item.name,
        url: getAvatarImageUrl(item.visual, item.visual),
        visual: item.visual,
        isFree: item.isFree === true || item.cost === 0
      };
    }
  }

  // 2. Check explicit pre-resolved photoURL or avatar URL
  const rawPhoto = user.photoURL || user.avatar || user.avatarUrl;
  if (rawPhoto && typeof rawPhoto === 'string' && (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://') || rawPhoto.startsWith('data:'))) {
    return {
      id: 'custom_avatar',
      name: user.displayName || 'Custom Avatar',
      url: rawPhoto,
      visual: rawPhoto,
      isFree: true
    };
  }

  // 3. Check user's owned / unlocked avatars
  const ownedList = user.unlockedAvatars || user.ownedAvatarIds || [];
  if (Array.isArray(ownedList) && ownedList.length > 0) {
    for (const ownedId of ownedList) {
      const item = avatarCatalog.find(i => i.id === ownedId || i.visual === ownedId);
      if (item) {
        return {
          id: item.id,
          name: item.name,
          url: getAvatarImageUrl(item.visual, item.visual),
          visual: item.visual,
          isFree: item.isFree === true || item.cost === 0
        };
      }
    }
  }

  // 4. Find active free starter avatar
  const freeAvatar = avatarCatalog.find(i => i.isFree === true || i.cost === 0);
  if (freeAvatar) {
    return {
      id: freeAvatar.id,
      name: freeAvatar.name,
      url: getAvatarImageUrl(freeAvatar.visual, freeAvatar.visual),
      visual: freeAvatar.visual,
      isFree: true
    };
  }

  // 5. Guaranteed system default avatar fallback with deterministic seed
  const fallbackSeed = user.uid || user.displayName || SYSTEM_DEFAULT_AVATAR_VISUAL;
  return {
    id: SYSTEM_DEFAULT_AVATAR_ID,
    name: 'Starter Cadet',
    url: getAvatarImageUrl(SYSTEM_DEFAULT_AVATAR_VISUAL, fallbackSeed),
    visual: SYSTEM_DEFAULT_AVATAR_VISUAL,
    isFree: true
  };
}

/**
 * Returns directly the resolved avatar image URL string for <img> tags.
 * Ensures the component never gets null, undefined, or broken paths.
 */
export function getUserAvatarUrl(user?: Partial<UserProfile> | any): string {
  if (user && typeof user === 'string') {
    // In case raw visual seed or url was passed directly
    return getAvatarImageUrl(user);
  }
  return resolveUserAvatar(user).url;
}
