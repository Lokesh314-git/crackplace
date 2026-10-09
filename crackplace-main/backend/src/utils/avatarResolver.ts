import { COSMETICS_CATALOG, CosmeticItem } from './cosmetics';

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
 * Server-authoritative unified Avatar Resolver.
 * Priority:
 * 1. User's currently equipped avatar (if valid & user owns it or it is free)
 * 2. User's owned avatar (first valid active owned avatar in catalog)
 * 3. Any available active free avatar from catalog
 * 4. System default fallback avatar
 */
export function resolveUserAvatar(
  user?: any,
  catalog: CosmeticItem[] = COSMETICS_CATALOG
): ResolvedAvatar {
  const avatarCatalog = catalog.filter(i => i.category === 'avatar' && (i.isActive !== false));

  // 1. Check user's equipped avatar
  const equippedId = user?.equippedAvatar || user?.equippedAvatarId;
  if (equippedId && typeof equippedId === 'string') {
    const item = avatarCatalog.find(i => i.id === equippedId || i.visual === equippedId);
    if (item) {
      const isFree = item.isFree === true || item.cost === 0;
      const ownedList = user?.unlockedAvatars || user?.ownedAvatarIds || [];
      const isOwned = isFree || (Array.isArray(ownedList) && (ownedList.includes(item.id) || ownedList.includes(item.visual)));
      if (isOwned) {
        return {
          id: item.id,
          name: item.name,
          url: getAvatarImageUrl(item.visual, item.visual),
          visual: item.visual,
          isFree
        };
      }
    }
  }

  // 2. Check explicit pre-resolved photoURL or avatar URL
  const rawPhoto = user?.photoURL || user?.avatar || user?.avatarUrl;
  if (rawPhoto && typeof rawPhoto === 'string' && (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://') || rawPhoto.startsWith('data:'))) {
    return {
      id: 'custom_avatar',
      name: user?.displayName || 'Custom Avatar',
      url: rawPhoto,
      visual: rawPhoto,
      isFree: true
    };
  }

  // 2. Check user's owned avatars
  const ownedList = user?.unlockedAvatars || user?.ownedAvatarIds || [];
  if (Array.isArray(ownedList) && ownedList.length > 0) {
    for (const ownedId of ownedList) {
      const item = avatarCatalog.find(i => i.id === ownedId);
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

  // 3. Find any active free avatar
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

  // 4. Guaranteed system default avatar fallback
  const fallbackSeed = user?.uid || SYSTEM_DEFAULT_AVATAR_VISUAL;
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
 */
export function getUserAvatarUrl(user?: any): string {
  return resolveUserAvatar(user).url;
}
