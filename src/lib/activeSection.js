/**
 * activeSection.js — SINGLE SOURCE OF TRUTH for mobile section identity.
 *
 * Answers one question: which BOTTOM-NAV section does this path belong to?
 *
 *   CURRENT ROUTE → CURRENT MAIN SECTION → BOTTOM-NAV ITEM → green active
 *
 * Why this exists: React Router's NavLink isActive is per-link and can
 * never match nested/detail/tool routes that have no nav entry of their
 * own (/crops, /crops/:id, /disease, /fertilizer, /finance, /market).
 * On those pages NavLink highlights NOTHING (or, for /crops and /farm,
 * BOTH Overview and My Farm at once, since neither is `end`) — the
 * reported "no item / wrong item highlighted" bug. The page transition
 * animation never changes the URL, so it cannot affect this logic.
 *
 * One resolver, consumed by BOTH mobile navs (bottom bar + drawer +
 * desktop Sidebar's mapped tools): the same route always produces the
 * same section everywhere, in every language and theme. Stable route
 * prefixes are the identifiers — never translated display labels.
 */

/** Bottom-nav sections in bar order (stable ids = route prefixes). */
export const SECTION_ROUTES = [
  '/',
  '/farm',
  '/ai-doctor',
  '/improve',
  '/insights',
];

/** Longest-prefix match so /ai-doctor wins over / before / is tested. */
export function resolveActiveSection(pathname) {
  if (!pathname) return null;
  return SECTION_ROUTES.find((r) =>
    r === '/' ? pathname === '/' : pathname.startsWith(r),
  ) || null;
}

/**
 * Tool routes with no nav entry of their own → their parent SECTION.
 * Derived from real in-app flows: My Farm → Crops → CropDetails offers
 * Disease/Fertilizer/Market, and the Dashboard MarketCard opens Market.
 * "/finance" is listed for future-proofing; on mobile today it is only
 * reachable from the drawer (its drawer link stays active there).
 */
const TOOL_TO_SECTION = {
  '/crops': '/farm',
  '/disease': '/farm',
  '/fertilizer': '/farm',
  '/finance': '/farm',
  '/market': '/farm',
};

/**
 * Resolve the path's own section, or its parent section for mapped tool
 * routes. Unknown paths (settings, login, …) → null = NO bottom-nav item
 * is active, which is the honest state for a page outside every section.
 */
export function resolveSectionForPath(pathname) {
  const own = resolveActiveSection(pathname);
  if (own) return own;
  const tool = Object.keys(TOOL_TO_SECTION).find((t) => pathname?.startsWith(t));
  return tool ? TOOL_TO_SECTION[tool] : null;
}
