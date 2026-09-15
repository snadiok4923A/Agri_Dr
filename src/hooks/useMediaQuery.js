import { useEffect, useState } from "react";

/**
 * Reactive CSS media-query hook.
 * Returns true while the query matches (e.g. "(max-width: 900px)").
 * Used by the Dashboard to pair Voice Mode + Market side-by-side on mobile
 * while keeping the desktop grid pairing, which pure CSS cannot express
 * for the same DOM nodes.
 */
export default function useMediaQuery(query) {
    const [matches, setMatches] = useState(
        () => typeof window !== "undefined" && window.matchMedia(query).matches,
    );

    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = (e) => setMatches(e.matches);
        mql.addEventListener("change", onChange);
        setMatches(mql.matches);
        return () => mql.removeEventListener("change", onChange);
    }, [query]);

    return matches;
}
