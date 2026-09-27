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
 * Two persistence tiers, chosen automatically:
 *   • signed-in user  → Supabase (profiles/farms/land_parcels; tables may
 *     be absent — onboardingService degrades silently) + a local mirror
 *   • guest           → localStorage only ("skipped" counts as a terminal
 *     choice, so guests are never re-prompted)
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
const LS_COMPLETED = "krisiveda.onboarding.completed";
const LS_SKIPPED = "krisiveda.onboarding.skipped";
const LS_DRAFT = "krisiveda.onboarding.draft"; // guest: full farm data
const LS_LANG = "krisiveda.onboarding.lang"; // chosen during onboarding

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

/** Persisted guest/user farm snapshot (mirrors the Supabase parcel shape). */
function readLocalFarm() {
    const raw = lsGet(LS_DRAFT);
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

export function OnboardingProvider({ children }) {
    const { user, isGuest, isAuthenticated } = useAuth();
    const userId = user && !isGuest ? user.id : null;

    /** undefined = still loading from Supabase/localStorage (gates hold UI). */
    const [status, setStatus] = useState("loading");
    const [completed, setCompleted] = useState(false);
    const [skipped, setSkipped] = useState(false);
    const [farm, setFarm] = useState({ name: "", parcels: [] });
    /** Guest re-onboarding: the empty-state CTA re-opens the FULL wizard
     *  for a guest (fresh guests must NOT see it — they already skipped). */
    const [redo, setRedo] = useState(false);

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
            const local = readLocalFarm();
            setFarm(local || { name: "", parcels: [] });
            setCompleted(lsGet(LS_COMPLETED) === "1");
            setSkipped(lsGet(LS_SKIPPED) === "1");
            setStatus("ready");
            return undefined;
        }

        if (!userId) {
            // Signed out (pre-login page visits) — anonymous mirror only.
            setFarm({ name: "", parcels: [] });
            setCompleted(false);
            setSkipped(false);
            setStatus("ready");
            return undefined;
        }

        setStatus("loading");
        (async () => {
            // Local mirror first (instant UI), then Supabase truth.
            const local = readLocalFarm();
            if (!cancelled) setFarm(local || { name: "", parcels: [] });
            setCompleted(lsGet(LS_COMPLETED) === "1");
            setSkipped(false); // server flag decides for real users

            const [profile, farmRow, parcels] = await Promise.all([
                fetchOnboardingState(userId),
                fetchFarm(userId),
                fetchParcels(userId),
            ]);
            if (cancelled) return;

            /* Server is the source of truth, BUT the local mirror counts
               too: when the schema/migration is absent (profile === null)
               a user who already finished once locally is never re-prompted,
               and brand-new sign-ups still flow through onboarding. */
            const serverCompleted = !!profile?.onboardingCompleted;
            const localCompleted = lsGet(LS_COMPLETED) === "1";
            const localSkipped = lsGet(LS_SKIPPED) === "1";
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
                lsSet(LS_DRAFT, JSON.stringify(nextFarm));
            } else if (!local) {
                setFarm({ name: "", parcels: [] });
            }
            setStatus("ready");
        })();

        return () => {
            cancelled = true;
        };
    }, [isGuest, userId]);

    /** Write-through helper: Supabase first (fire-and-forget), local mirror. */
    const mirror = useCallback((nextFarm) => {
        lsSet(LS_DRAFT, JSON.stringify(nextFarm));
    }, []);

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
            setRedo(false);
            mirror(nextFarm);
            lsSet(LS_COMPLETED, "1");
            lsDel(LS_SKIPPED);

            if (userId) {
                if (selectedLanguage) lsSet(LS_LANG, selectedLanguage);
                await saveProfileState(userId, {
                    selectedLanguage: selectedLanguage || undefined,
                    onboardingCompleted: true,
                    onboardingSkipped: false,
                });
                const farmId = await upsertFarm(userId, nextFarm.name);
                if (farmId) await replaceParcels(userId, farmId, nextFarm.parcels);
            }
            return nextFarm;
        },
        [userId, mirror],
    );

    /** "Skip for now" inside the wizard (or re-skip later). The language
     *  picked in step 1 still persists — a skipped user keeps their voice. */
    const skipOnboarding = useCallback(
        async ({ selectedLanguage } = {}) => {
            setSkipped(true);
            setCompleted(false);
            setRedo(false);
            if (selectedLanguage) lsSet(LS_LANG, selectedLanguage);
            lsSet(LS_SKIPPED, "1");
            lsDel(LS_COMPLETED);
            if (userId) {
                await saveProfileState(userId, {
                    selectedLanguage: selectedLanguage || undefined,
                    onboardingCompleted: false,
                    onboardingSkipped: true,
                });
            }
        },
        [userId],
    );

    /** Draft autosave (Back/Next between steps) — local only. */
    const saveDraft = useCallback(
        (draft) => {
            if (!draft) return;
            mirror({
                farmName: draft.farmName || "",
                parcels: draft.parcels || [],
            });
        },
        [mirror],
    );

    /** Re-open the wizard later (empty-state CTA / Settings). */
    const resetOnboarding = useCallback(() => {
        setCompleted(false);
        setSkipped(false);
        setRedo(true);
        lsDel(LS_COMPLETED);
        lsDel(LS_SKIPPED);
        if (userId) {
            // Server flags clear too — the wizard is the single source of truth.
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
            redo,
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
            redo,
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
