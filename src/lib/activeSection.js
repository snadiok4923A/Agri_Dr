/**
 * activeSection.js — SINGLE SOURCE OF TRUTH for mobile section identity.
 *
 * Answers one question: which BOTTOM-NAV section does this path belong to?
 *
 *   CURRENT ROUTE → CURRENT MAIN SECTION → BOTTOM-NAV ITEM → green active
 *
 * Why this exists: React Router's NavLink isActive is per-link and can
 * never match nested/detail routes that have no nav entry of their own
 * (/crops/parcel-1). On those pages NavLink highlights NOTHING (or, for
 * /crops and /farm, BOTH Overview and My Farm at once, since neither is
 * `end`) — the reported "no item / wrong item highlighted" bug. The page
 * transition animation never changes the URL, so it cannot affect this
 * logic.
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
 * Resolve the path's own section, or null for pages outside every
 * bottom-nav section. Sidebar-only features (Rice Varieties /crops,
 * Disease /disease, Fertilizer /fertilizer, Cost & Profit /finance,
 * Market Intelligence /market, Settings /settings) are STANDALONE —
 * they activate NOTHING (spec: "activeItem = null" is a valid state;
 * no fallback may keep My Farm green just because the shell contains
 * them). The single exception is a GENUINE child of a bottom-nav
 * section: a My Farm parcel detail (/crops/parcel-*) — My Farm stays
 * active there because that page IS part of the My Farm flow.
 */
export function resolveSectionForPath(pathname) {
  if (!pathname) return null;
  const own = resolveActiveSection(pathname);
  if (own) return own;
  // Genuine child of My Farm: the parcel detail opened from the farm map.
  if (pathname.startsWith('/crops/parcel-')) return '/farm';
  return null;
}
