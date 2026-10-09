import { resolveUserAvatar, getUserAvatarUrl, SYSTEM_DEFAULT_AVATAR_ID } from '../utils/avatarResolver';
import { COSMETICS_CATALOG, CosmeticItem } from '../utils/cosmetics';

describe('Avatar Ownership, Equipment & Free Fallback System', () => {
  // Free avatars in catalog
  const freeAvatars = COSMETICS_CATALOG.filter(i => i.category === 'avatar' && (i.isFree === true || i.cost === 0));
  const paidAvatars = COSMETICS_CATALOG.filter(i => i.category === 'avatar' && !i.isFree && i.cost > 0);

  test('Catalog has active free starter avatars configured', () => {
    expect(freeAvatars.length).toBeGreaterThanOrEqual(1);
    const starter = freeAvatars.find(i => i.id === 'avatar_starter');
    expect(starter).toBeDefined();
    expect(starter?.cost).toBe(0);
    expect(starter?.isFree).toBe(true);
  });

  test('TEST 1: New user receives free avatar automatically', () => {
    const newUser = {
      uid: 'user_new_123',
      displayName: 'New Cadet',
      equippedAvatar: 'avatar_starter',
      unlockedAvatars: ['avatar_starter']
    };

    const resolved = resolveUserAvatar(newUser);
    expect(resolved.id).toBe('avatar_starter');
    expect(resolved.isFree).toBe(true);
    expect(resolved.url).toContain('api.dicebear.com');
  });

  test('TEST 2: Existing user with no avatar (null/undefined) resolves to a free avatar', () => {
    const existingUserNoAvatar = {
      uid: 'user_legacy_456',
      displayName: 'Old Cadet',
      equippedAvatar: null,
      unlockedAvatars: []
    };

    const resolved = resolveUserAvatar(existingUserNoAvatar);
    expect(resolved.isFree).toBe(true);
    expect(resolved.id).toBe('avatar_starter');
    expect(resolved.url).toBeDefined();
    expect(resolved.url.length).toBeGreaterThan(0);
  });

  test('TEST 3: User owns Avatar A and Avatar B, equipped = Avatar B -> Avatar B resolved', () => {
    const user = {
      uid: 'user_multi_owned',
      equippedAvatar: 'avatar_ai_robot',
      unlockedAvatars: ['avatar_cyber_hacker', 'avatar_ai_robot', 'avatar_ninja']
    };

    const resolved = resolveUserAvatar(user);
    expect(resolved.id).toBe('avatar_ai_robot');
    expect(resolved.name).toBe('AI Robot');
  });

  test('TEST 4: User owns paid Avatar A, equipped = Avatar A -> Avatar A resolved', () => {
    const paidAvatar = paidAvatars[0];
    const user = {
      uid: 'user_paid_owner',
      equippedAvatar: paidAvatar.id,
      unlockedAvatars: [paidAvatar.id]
    };

    const resolved = resolveUserAvatar(user);
    expect(resolved.id).toBe(paidAvatar.id);
    expect(resolved.name).toBe(paidAvatar.name);
  });

  test('TEST 5: Equipped avatar becomes unavailable/disabled -> Fallback to valid owned avatar', () => {
    const customCatalog: CosmeticItem[] = [
      { id: 'avatar_free_1', name: 'Starter', category: 'avatar', cost: 0, isFree: true, visual: 'starter', description: '', isActive: true, rarity: 'common' },
      { id: 'avatar_deleted_1', name: 'Deleted Bot', category: 'avatar', cost: 100, isFree: false, visual: 'deleted', description: '', isActive: false, rarity: 'rare' },
      { id: 'avatar_owned_backup', name: 'Owned Backup', category: 'avatar', cost: 150, isFree: false, visual: 'backup', description: '', isActive: true, rarity: 'rare' }
    ];

    const user = {
      uid: 'user_broken_equip',
      equippedAvatar: 'avatar_deleted_1',
      unlockedAvatars: ['avatar_deleted_1', 'avatar_owned_backup']
    };

    const resolved = resolveUserAvatar(user, customCatalog);
    expect(resolved.id).toBe('avatar_owned_backup');
  });

  test('TEST 6: User with no owned avatars -> Resolves to active free avatar', () => {
    const user = {
      uid: 'user_no_owned',
      equippedAvatar: null,
      unlockedAvatars: undefined
    };

    const resolved = resolveUserAvatar(user);
    expect(resolved.isFree).toBe(true);
    expect(resolved.id).toBe('avatar_starter');
  });

  test('TEST 7: Invalid/corrupted equippedAvatarId -> Resolves safely to fallback', () => {
    const user = {
      uid: 'user_corrupt_id',
      equippedAvatar: 'nonexistent_avatar_999999_xyz',
      unlockedAvatars: []
    };

    const resolved = resolveUserAvatar(user);
    expect(resolved).toBeDefined();
    expect(resolved.id).toBe('avatar_starter');
    expect(resolved.url).toBeTruthy();
  });

  test('TEST 8: User cannot equip an unowned paid avatar', () => {
    const paidAvatar = paidAvatars[0];
    const user = {
      uid: 'user_unauthorized_equip',
      equippedAvatar: paidAvatar.id, // Trying to equip paid avatar without owning it
      unlockedAvatars: [] // Does not own it
    };

    const resolved = resolveUserAvatar(user);
    // Should NOT allow the unowned paid avatar; must fallback to free starter
    expect(resolved.id).not.toBe(paidAvatar.id);
    expect(resolved.isFree).toBe(true);
  });

  test('TEST 9: Any user can equip any free avatar without purchasing', () => {
    const apprenticeAvatar = COSMETICS_CATALOG.find(i => i.id === 'avatar_apprentice');
    expect(apprenticeAvatar).toBeDefined();

    const user = {
      uid: 'user_equipping_free',
      equippedAvatar: 'avatar_apprentice',
      unlockedAvatars: [] // No purchases
    };

    const resolved = resolveUserAvatar(user);
    expect(resolved.id).toBe('avatar_apprentice');
    expect(resolved.isFree).toBe(true);
  });

  test('TEST 10: Null or undefined user object never crashes and returns system default', () => {
    const resolvedNull = resolveUserAvatar(null);
    expect(resolvedNull).toBeDefined();
    expect(resolvedNull.id).toBe(SYSTEM_DEFAULT_AVATAR_ID);
    expect(resolvedNull.url).toBeTruthy();

    const resolvedUndefined = resolveUserAvatar(undefined);
    expect(resolvedUndefined).toBeDefined();
    expect(resolvedUndefined.id).toBe(SYSTEM_DEFAULT_AVATAR_ID);
    expect(resolvedUndefined.url).toBeTruthy();

    const urlString = getUserAvatarUrl({});
    expect(urlString).toBeTruthy();
    expect(urlString.startsWith('http')).toBe(true);
  });
});
