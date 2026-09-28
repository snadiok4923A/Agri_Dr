/**
 * profileStore.js — USER-SCOPED local profile state (photo, name, role).
 *
 * DATA-ISOLATION CONTRACT (profile-picture spec §2/§3/§7):
 *
 *   Supabase authenticated user → user.id → that user's profile data
 *
 * Every key is namespaced by the SIGNED-IN user's Supabase id
 * (`krisiveda.profileImage.<userId>` etc.). No shared/fixed key exists,
 * so one account's photo can never be read or overwritten by another:
 * loading/writing only ever happens through the current user's own keys.
 *
 * Lifetime rules (spec §9/§10 + onboarding precedent):
 *   • identity change → in-memory state CLEARS first, then ONLY the new
 *     identity's own scoped values load (never the previous user's).
 *   • sign-out → memory cleared; each account's OWN scoped keys stay so
 *     their photo returns on their next login (TEST 5). There is no
 *     server-side copy yet, so these scoped keys are the account's only
 *     persistence — deleting them would destroy the user's picture.
 *   • pre-fix GLOBAL keys are deleted on the next sign-in/out; the
 *     legacy IMAGE is never re-adopted (adopting it would hand the last
 *     device user's photo to the next account — the very bug being
 *     fixed); the low-sensitivity name/role are adopted once.
 *
 * Framework-free on purpose: storage is base64-in-localStorage because
 * the app has no Supabase Storage bucket yet. If server-side avatars are
 * added later only the WRITE path in Header.jsx changes — the keying and
 * isolation rules here stay identical.
 */

/* The legacy pre-fix GLOBAL keys (shared by every account — the bug). */
const LEGACY_IMAGE_KEY = "krisiveda.profileImage";
const LEGACY_NAME_KEY = "krisiveda.profileName";
const LEGACY_ROLE_KEY = "krisiveda.profileRole";
const LEGACY_KEYS = [LEGACY_IMAGE_KEY, LEGACY_NAME_KEY, LEGACY_ROLE_KEY];

/* Scoped key builders — the ONLY way to address profile data. */
export const profileImageKeyFor = (userId) =>
  `krisiveda.profileImage.${userId}`;
export const profileNameKeyFor = (userId) =>
  `krisiveda.profileName.${userId}`;
export const profileRoleKeyFor = (userId) =>
  `krisiveda.profileRole.${userId}`;

export function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — persistence simply doesn't survive refresh */
  }
}

export function lsDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

/** Destroy the shared pre-fix keys (safe to call any time). */
export function purgeLegacyProfileKeys() {
  LEGACY_KEYS.forEach(lsDel);
}

/**
 * One-time migration for a signing-in user: adopt the pre-fix global
 * NAME/ROLE into their scope (if they don't already have one), then
 * delete ALL legacy copies — including the image, which is deliberately
 * NOT adopted so no account can ever inherit another's picture.
 */
export function adoptLegacyProfileKeys(userId) {
  if (!userId) return;
  const name = lsGet(LEGACY_NAME_KEY);
  const role = lsGet(LEGACY_ROLE_KEY);
  if (name && !lsGet(profileNameKeyFor(userId))) {
    lsSet(profileNameKeyFor(userId), name);
  }
  if (role && !lsGet(profileRoleKeyFor(userId))) {
    lsSet(profileRoleKeyFor(userId), role);
  }
  purgeLegacyProfileKeys();
}

/**
 * Account deletion (spec §10): wipe EVERY trace of THIS user from the
 * browser — profile photo/name/role, onboarding mirrors, per-user
 * session storage — without touching any other account's scoped keys
 * or the app's device-level preferences (theme, language, notifications).
 * Used after the server confirms the auth account is really gone.
 */
export function purgeAccountData(userId) {
  if (!userId) return;
  [
    profileImageKeyFor(userId),
    profileNameKeyFor(userId),
    profileRoleKeyFor(userId),
    `krisiveda.onboarding.draft.${userId}`,
    `krisiveda.onboarding.completed.${userId}`,
    `krisiveda.onboarding.skipped.${userId}`,
    `krisiveda.sessionStorage.${userId}`,
  ].forEach(lsDel);
}

/** Read one user's profile value (null-safe; null userId → null). */
export function readProfileValue(keyFor, userId) {
  if (!userId) return null;
  return lsGet(keyFor(userId));
}

/** Write one profile value for a user (null userId → no-op). */
export function writeProfileValue(keyFor, userId, value) {
  if (!userId) return;
  if (value == null || value === "") lsDel(keyFor(userId));
  else lsSet(keyFor(userId), value);
}
