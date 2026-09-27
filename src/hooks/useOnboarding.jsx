/*
 * useOnboarding.jsx — global onboarding state for the whole app.
 *
 * ARCHITECTURE (mirrors useAuth):
 *
 *   onboardingService.js (pure Supabase logic)  ← no React, no UI
 *            ↓
 *   OnboardingProvider (this file: state + actions + persistence)
 *            ↓
 *   OnboardingWizard / OnboardingGate / empty states  ← presentation only
 *
 * Three persistence tiers, chosen by identity:
 *   • signed-in user  → Supabase (profiles/farms/land_parcels; tables may
 *     be absent — onboardingService degrades silently) + a USER-SCOPED
 *     local mirror for instant UI on the next visit
 *   • guest           → anonymous localStorage scratch only
 *   • signed out      → NOTHING: all private state is wiped from memory
 *     and the anonymous scratch is cleared (data-isolation spec §1/§2/§5)
 *
 * DATA ISOLATION (spec §12/§13): a signed-in user's draft + completed
 * flags live under USER-SCOPED keys that no other identity ever reads.
 * The un-scoped keys are anonymous scratch space; they are wiped on
 * sign-out and on guest entry, so the previous user's farm can never
 * leak into a guest or pre-login session.
 *
 * Identity changes (login/logout) reload the state from the new source.
 */

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    useCallback,
    useRef,
} from "react";
import { useAuth } from "./useAuth";
import {
    fetchOnboardingState,
    saveProfileState,
    fetchFarm,
    upsertFarm,
    fetchParcels,
    replaceParcels,
} from "../lib/onboardingService";

const OnboardingContext = createContext(null);

/* localStorage namespace — one key per tier, never mixed. */
const LS_COMPLETED = "krisiveda.onboarding.completed"; // anonymous scratch
const LS_SKIPPED = "krisiveda.onboarding.skipped"; // anonymous scratch
const LS_DRAFT = "krisiveda.onboarding.draft"; // anonymous scratch
const LS_LANG = "krisiveda.onboarding.lang"; // chosen during onboarding

/** User-scoped mirrors for the signed-in tier (never cross accounts). */
const draftKeyFor = (userId) => `krisiveda.onboarding.draft.${userId}`;
const completedKeyFor = (userId) => `krisiveda.onboarding.completed.${userId}`;
const skippedKeyFor = (userId) => `krisiveda.onboarding.skipped.${userId}`;

function lsGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}
function lsSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* private mode — persistence simply doesn't survive refresh */
    }
}
function lsDel(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        /* noop */
    }
}

/** Persisted farm snapshot (mirrors the Supabase parcel shape). */
function readLocalFarm(key) {
    const raw = lsGet(key);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.parcels)) return null;
        return {
            farmName: typeof parsed.farmName === "string" ? parsed.farmName : "",
            parcels: parsed.parcels,
        };
    } catch {
        return null;
    }
}

/**
 * Drop every piece of private onboarding state — memory AND the anonymous
 * scratch keys. The user-scoped mirrors are intentionally KEPT: they belong
 * to the signed-out account and are restored when that account logs back
 * in (spec §6: sign-out clears local state, never Supabase data).
 */
function clearPrivateState(setters) {
    setters.setFarm({ name: "", parcels: [] });
    setters.setCompleted(false);
    setters.setSkipped(false);
    lsDel(LS_DRAFT);
    lsDel(LS_COMPLETED);
    lsDel(LS_SKIPPED);
}

export function OnboardingProvider({ children }) {
    const { user, isGuest, isAuthenticated } = useAuth();
    /* A user id exists ONLY for a real Supabase session — the skipped
       preference never yields an identity (no fake user objects). */
    const userId = user?.id || null;

    /** "loading" = still loading from Supabase/localStorage (gates hold UI). */
    const [status, setStatus] = useState("loading");
    const [completed, setCompleted] = useState(false);
    const [skipped, setSkipped] = useState(false);
    const [farm, setFarm] = useState({ name: "", parcels: [] });

    const loadedForRef = useRef(undefined); // last identity the state was loaded for

    /* ------------------------------------------------------------------
     * Load persisted state whenever the identity changes.
     * ------------------------------------------------------------------ */
    useEffect(() => {
        const identity = isGuest ? "guest" : userId || "anonymous";
        if (loadedForRef.current === identity) return;
        loadedForRef.current = identity;

        let cancelled = false;

        if (isGuest) {
            /* Anonymous tier — NEVER reads signed-in user data (spec §13).
               The scratch keys may still hold the PREVIOUS user's farm
               (e.g. a SIGNED_OUT event that never fired because the tab
               was closed), so start by wiping them. A guest session starts
               with an empty farm; their own wizard scratch is rebuilt. */
            clearPrivateState({ setFarm, setCompleted, setSkipped });
            setStatus("ready");
            return undefined;
        }

        if (!userId) {
            /* Signed out: hard-clear ALL private state immediately (spec
               §1/§2/§5) — memory AND the anonymous scratch keys. Farm data
               is never read from localStorage without a real session. */
            clearPrivateState({ setFarm, setCompleted, setSkipped });
            setStatus("ready");
            return undefined;
        }

        /* ---------------- real, authenticated user ---------------- */
        setStatus("loading");
        const draftKey = draftKeyFor(userId);
        const completedKey = completedKeyFor(userId);
        const skippedKey = skippedKeyFor(userId);

        // One-time migration: adopt the pre-fix GLOBAL mirror (the bug
        // shipped this way) into this user's scoped keys, then drop the
        // shared copy so the anonymous tier can never read it again.
        if (!lsGet(draftKey) && lsGet(LS_DRAFT)) {
            lsSet(draftKey, lsGet(LS_DRAFT));
            lsDel(LS_DRAFT);
        }
        if (lsGet(completedKey) !== "1" && lsGet(LS_COMPLETED) === "1") {
            lsSet(completedKey, "1");
            lsDel(LS_COMPLETED);
        }

        (async () => {
            // User-scoped local mirror first (instant UI), then Supabase truth.
            const local = readLocalFarm(draftKey);
            if (!cancelled) setFarm(local || { name: "", parcels: [] });
            setCompleted(lsGet(completedKey) === "1");
            setSkipped(false); // server flag decides for real users

            const [profile, farmRow, parcels] = await Promise.all([
                fetchOnboardingState(userId),
                fetchFarm(userId),
                fetchParcels(userId),
            ]);
            if (cancelled) return;

            /* Server is the source of truth, BUT the user's local mirror
               counts too: when the schema/migration is absent
               (profile === null) a user who already finished once locally
               is never re-prompted, and brand-new sign-ups still flow
               through onboarding. */
            const serverCompleted = !!profile?.onboardingCompleted;
            const localCompleted = lsGet(completedKey) === "1";
            const localSkipped = lsGet(skippedKey) === "1";
            setCompleted(serverCompleted || localCompleted);
            setSkipped(
                !serverCompleted &&
                    !localCompleted &&
                    (!!profile?.onboardingSkipped || localSkipped),
            );
            if (profile?.selectedLanguage) lsSet(LS_LANG, profile.selectedLanguage);

            if (farmRow || (parcels && parcels.length)) {
                const nextFarm = {
                    name: farmRow?.name || "",
                    parcels: parcels || [],
                };
                setFarm(nextFarm);
                lsSet(draftKey, JSON.stringify(nextFarm));
            } else if (!local) {
                setFarm({ name: "", parcels: [] });
            }
            setStatus("ready");
        })();

        return () => {
            cancelled = true;
        };
    }, [isGuest, userId]);

    /* ------------------------------------------------------------------
     * Actions — consumed by the wizard and empty states.
     * ------------------------------------------------------------------ */

    /** NOTE: the language choice itself is applied + persisted by the
     *  EXISTING language system (useLanguage.changeLanguage → localStorage
     *  `krisiveda-lang`) at pick time. The wizard only passes the code
     *  along to completeOnboarding/skipOnboarding for the profile write. */

    /** Commit the full farm (wizard Done step). Returns the saved farm. */
    const completeOnboarding = useCallback(
        async ({ farmName, parcels, selectedLanguage }) => {
            const nextFarm = {
                name: farmName || "",
                parcels: (parcels || []).map((p, i) => ({ ...p, order: i })),
            };
            setFarm(nextFarm);
            setCompleted(true);
            setSkipped(false);

            if (userId) {
                // Signed-in tier: write the USER-SCOPED mirror only.
                lsSet(draftKeyFor(userId), JSON.stringify(nextFarm));
                lsSet(completedKeyFor(userId), "1");
                lsDel(skippedKeyFor(userId));
                lsDel(LS_COMPLETED);
                lsDel(LS_SKIPPED);
                if (selectedLanguage) lsSet(LS_LANG, selectedLanguage);
                await saveProfileState(userId, {
                    selectedLanguage: selectedLanguage || undefined,
                    onboardingCompleted: true,
                    onboardingSkipped: false,
                });
                const farmId = await upsertFarm(userId, nextFarm.name);
                if (farmId) await replaceParcels(userId, farmId, nextFarm.parcels);
            } else {
                // Guest tier: anonymous scratch only (never user data).
                lsSet(LS_DRAFT, JSON.stringify(nextFarm));
                lsSet(LS_COMPLETED, "1");
                lsDel(LS_SKIPPED);
            }
            return nextFarm;
        },
        [userId],
    );

    /** "Skip for now" inside the wizard (or re-skip later). The language
     *  picked in step 1 still persists — a skipped user keeps their voice. */
    const skipOnboarding = useCallback(
        async ({ selectedLanguage } = {}) => {
            setSkipped(true);
            setCompleted(false);
            if (selectedLanguage) lsSet(LS_LANG, selectedLanguage);
            if (userId) {
                lsDel(completedKeyFor(userId));
                // Persist the farm-details skip locally so the user lands
                // in the website on the next visit too (spec §8: skipping
                // farm details must not re-block the app), with the
                // server flag as the durable copy when the tables exist.
                lsSet(skippedKeyFor(userId), "1");
                await saveProfileState(userId, {
                    selectedLanguage: selectedLanguage || undefined,
                    onboardingCompleted: false,
                    onboardingSkipped: true,
                });
            } else {
                lsSet(LS_SKIPPED, "1");
                lsDel(LS_COMPLETED);
            }
        },
        [userId],
    );

    /** Draft autosave (Back/Next between steps) — user-scoped, local only. */
    const saveDraft = useCallback(
        (draft) => {
            if (!draft) return;
            if (!userId) return; // no wizard without auth; nothing to persist
            lsSet(
                draftKeyFor(userId),
                JSON.stringify({
                    farmName: draft.farmName || "",
                    parcels: draft.parcels || [],
                }),
            );
        },
        [userId],
    );

    /** Re-open the wizard later (empty-state CTA / Settings). */
    const resetOnboarding = useCallback(() => {
        setCompleted(false);
        setSkipped(false);
        lsDel(LS_COMPLETED); // legacy shared copy, if any
        lsDel(LS_SKIPPED);
        if (userId) {
            // User-scoped flag clears too — the wizard is the single
            // source of truth. The user's Supabase farm rows are NOT
            // touched here (only the completion flag flips).
            lsDel(completedKeyFor(userId));
            lsDel(skippedKeyFor(userId));
            saveProfileState(userId, {
                onboardingCompleted: false,
                onboardingSkipped: false,
            });
        }
    }, [userId]);

    /** Signed-in completion state (guests: local only). */
    const isFarmComplete = completed;

    const value = useMemo(
        () => ({
            status,
            completed,
            skipped,
            farm,
            isGuest,
            isAuthenticated,
            isFarmComplete,
            completeOnboarding,
            skipOnboarding,
            saveDraft,
            resetOnboarding,
        }),
        [
            status,
            completed,
            skipped,
            farm,
            isGuest,
            isAuthenticated,
            isFarmComplete,
            completeOnboarding,
            skipOnboarding,
            saveDraft,
            resetOnboarding,
        ],
    );

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
    return ctx;
}
