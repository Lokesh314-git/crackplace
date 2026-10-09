# CrackPlace AI — Avatar Ownership, Equipment & Free Fallback System

## Overview

The Avatar Ownership, Equipment, and Free Fallback System ensures that **every user always has a valid, visually appealing avatar displayed throughout CrackPlace AI**. No user profile, leaderboard row, multiplayer battle screen, navbar icon, or scorecard will ever render broken image icons, empty circles, `null`, `undefined`, or corrupted image placeholders.

---

## 1. Avatar Priority Logic & Hierarchy

Avatar resolution is strictly single-source-of-truth across backend services, sockets, and client views. When resolving a user's avatar, the system follows this exact hierarchical sequence:

```
                  ┌─────────────────────────────────────────┐
                  │          resolveUserAvatar(user)         │
                  └────────────────────┬────────────────────┘
                                       │
                     Is user's equipped avatar valid,        
                     active, and owned (or free)?            
                                  /         \
                             YES /           \ NO
                                v             v
                    ┌─────────────────┐   Does user own another
                    │ RETURN EQUIPPED │   valid active avatar? 
                    └─────────────────┘         /         \
                                           YES /           \ NO
                                              v             v
                                  ┌──────────────┐   Is an active free 
                                  │ RETURN OWNED │   avatar available?
                                  └──────────────┘         /         \
                                                      YES /           \ NO
                                                         v             v
                                             ┌─────────────┐   ┌───────────────────────┐
                                             │ RETURN FREE │   │ RETURN SYSTEM DEFAULT │
                                             └─────────────┘   └───────────────────────┘
```

1. **User's Currently Equipped Avatar (`equippedAvatar`)**: Checked first. Must exist in catalog, be active, and either be free or present in user's `unlockedAvatars`.
2. **User's Owned Avatar (`unlockedAvatars`)**: If the equipped avatar was deleted, disabled, or unowned, the resolver selects the first valid active owned avatar.
3. **Any Active Free Avatar (`isFree: true` / `cost: 0`)**: If the user has purchased no avatars, returns an active free starter avatar (`avatar_starter`, `avatar_apprentice`, `avatar_explorer`).
4. **System Default Avatar Fallback**: Final guaranteed fallback (`avatar_starter` seeded with user UID/starter via DiceBear SVG). **Never fails.**

---

## 2. Avatar Catalog & Starter Set

The catalog lives in `backend/src/utils/cosmetics.ts` and `frontend/src/config/cosmetics.ts`.

### Free Starter Avatars (Cost: 0 Coins)

| ID | Name | Rarity | Visual Seed | Description |
|---|---|---|---|---|
| `avatar_starter` | Starter Cadet | Common | `starter` | Standard issue avatar for all incoming cadets. |
| `avatar_apprentice` | Code Apprentice | Common | `apprentice` | Curious learner mastering foundational algorithms. |
| `avatar_explorer` | Tech Explorer | Common | `explorer` | Adventurous engineer exploring digital frontiers. |

### Paid Premium Avatars (53+ Items)

A wide catalog of themed avatars ranging from Common (`avatar_programmer`, `avatar_geek`) to Legendary & Mythic (`avatar_samurai`, `avatar_phoenix`, `avatar_dragon_rider`, `avatar_quantum_coder`).

---

## 3. Data Model

### `CosmeticItem` Schema
```typescript
export interface CosmeticItem {
  id: string;
  name: string;
  category: 'avatar' | 'ring' | 'frame' | 'background' | 'title' | 'theme' | 'emote' | 'sticker';
  cost: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'secret';
  visual: string; // Seed slug or direct image URL
  description: string;
  isFree?: boolean;
  isActive?: boolean;
}
```

### `UserProfile` Avatar Fields
```typescript
export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string; // Authoritative URL pointing to active resolved avatar
  equippedAvatar?: string | null; // Catalog ID of equipped avatar
  unlockedAvatars?: string[]; // Array of purchased/owned avatar IDs
  // ...other gamification and academic fields
}
```

---

## 4. Centralized Resolver Architecture

Both backend and frontend import from centralized avatar resolvers:
- `backend/src/utils/avatarResolver.ts`
- `frontend/src/utils/avatarResolver.ts`

### Key Functions
- `resolveUserAvatar(user, catalog?)`: Returns `{ id, name, url, visual, isFree }`.
- `getUserAvatarUrl(user)`: Returns directly the guaranteed valid image URL string for `<img>` tags.
- `getAvatarImageUrl(visual, seed)`: Converts visual seeds into high-resolution SVG URLs (`adventurer`, `bottts`, `pixel-art`).

---

## 5. Security & Server-Authoritative Verification

1. **Equip Route (`POST /api/auth/profile/equip`)**:
   - Authenticates token.
   - Validates category (`avatar`, `ring`, etc.) and item exists in catalog.
   - For avatars: If `!item.isFree && item.cost > 0`, verifies `(userData.unlockedAvatars || []).includes(item.id)`.
   - Returns `403 Forbidden` (`You do not own this avatar`) if unowned.
   - Updates `equippedAvatar` and updates `photoURL` atomically.
   - On unequip, gracefully falls back to free starter avatar.

2. **Store Buy Route (`POST /api/auth/store/buy`)**:
   - Authenticates token.
   - Checks if item is free: Returns `400 Bad Request` (`Free items do not need to be purchased`).
   - Checks if already owned: Returns `400 Bad Request` (`Item already purchased`) to prevent double-charging.
   - Executes inside a Firestore Transaction: verifies coins balance $\ge$ cost, deducts coins, adds item ID to `unlockedAvatars`.

---

## 6. Existing User Auto-Recovery & Backward Compatibility

No manual database script is required for existing users:
- When a user logs in (`POST /api/auth/verify`), if `unlockedAvatars` is empty/missing, it is backfilled with `['avatar_starter']`.
- If `equippedAvatar` is null/undefined or corrupted, `resolveUserAvatar(userData)` automatically assigns a valid free avatar.
- Leaderboard queries and Battle Engine room creators map documents through `resolveUserAvatar(doc)` on-the-fly.

---

## 7. UI & Multiplayer Integrations

| Location | Avatar Resolution Behavior |
|---|---|
| **Navbar & Sidebar** | Always renders `getUserAvatarUrl(userProfile)`. |
| **Student Profile** | Displays equipped avatar with live level badge; shows opponent avatars in recent battle history. |
| **Global Leaderboard** | Podiums (#1, #2, #3), current candidate banner, and all table rows resolve through `getUserAvatarUrl`. |
| **Battle Arena Matchmaking** | Sockets exchange `avatar: getUserAvatarUrl(userProfile)` during matchmaking ticket submission. |
| **Battle Custom Lobby** | Host and guest cards render resolved avatars with real-time status. |
| **Battle Results Scorecard** | Final victory/defeat screen renders both `userProfile` and `opponent` avatars alongside authoritative scores and rating changes. |
| **Store & Armory** | Clearly distinguishes `FREE`, `OWNED`, and `UNLOCK` buttons with live avatar previews. |
