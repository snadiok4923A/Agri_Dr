import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* Floating language menu for the Profile Popup.
   Rendered through a portal under <body> with position: fixed, so it is
   completely independent of the popup's overflow, transforms, filters,
   backdrop-filters and stacking contexts — it cannot be clipped or
   buried by any of them. The popup merely passes the anchor (Language
   button) and the EXISTING language state/handlers; no second language
   system lives here. */

const GAP = 8; // distance between the anchor button and the menu

function LanguageMenu({ anchorRef, languages, activeCode, onSelect, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null); // { left, top } in viewport px

  /* Position: measure the anchor AND the real menu height, pick the
     placement with room for the full menu, clamp inside the viewport.
     - enough room below  → open below the button
     - else fits above    → flip above the button
     - else               → constrain to viewport, scroll internally */
  const place = useCallback(() => {
    const btn = anchorRef?.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;
    const b = btn.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return; // anchor unmounted
    const h = menu.offsetHeight;
    const w = menu.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top;
    if (vh - b.bottom - GAP >= h) top = b.bottom + GAP;
    else if (b.top - GAP >= h) top = b.top - GAP - h;
    else top = b.bottom + GAP;
    /* Final clamp: the anchor itself can sit off-viewport (popup content
       scrolled), so every branch is clamped — the menu is ALWAYS fully
       inside the viewport; internal scrolling handles the overflow. */
    top = Math.max(GAP, Math.min(top, vh - h - GAP));

    const left = Math.max(GAP, Math.min(b.left, vw - w - GAP));
    setPos((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
  }, [anchorRef]);

  /* First placement happens before paint (unpositioned renders at
     opacity 0 so nothing flashes at 0,0). Then re-anchor every frame
     while open — popup-internal scrolling, window resizes and mobile
     viewport changes can never leave the menu detached from its button. */
  useLayoutEffect(() => {
    place();
    let raf = requestAnimationFrame(function tick() {
      place();
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [place]);

  /* Safety net for events that can land between frames. */
  useEffect(() => {
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [place]);

  /* Escape closes just the menu (capture phase, propagation stopped so
     the popup's own Escape chain doesn't also fire for the same press);
     outside mousedown closes it; button re-click toggles via the popup. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    const onDown = (e) => {
      const t = e.target;
      if (menuRef.current?.contains(t)) return;
      if (anchorRef?.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose, anchorRef]);

  return createPortal(
    <div
      className="profile-modal__pref-menu"
      ref={menuRef}
      style={pos ? { left: pos.left, top: pos.top } : { opacity: 0, left: GAP, top: GAP }}
      role="menu"
      aria-label="Language"
    >
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          role="menuitem"
          className={`profile-modal__pref-option ${lang.code === activeCode ? 'profile-modal__pref-option--active' : ''}`}
          onClick={() => onSelect(lang.code)}
        >
          {lang.native}
        </button>
      ))}
    </div>,
    document.body
  );
}

export default LanguageMenu;
