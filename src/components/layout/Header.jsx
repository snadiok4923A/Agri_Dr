import { createPortal } from 'react-dom';
import {
  Bell, Sun, Moon, ChevronDown, Globe, Menu, Mic, Camera, X,
  Bug, TrendingDown, FlaskConical, TrendingUp, Activity, CheckCheck,
  UserPlus, LogOut, User,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { useVoiceMode } from '../../hooks/useVoiceMode';
import { useAuth } from '../../hooks/useAuth';
import { friendlyAuthError } from '../../lib/authService';
import {
  profileImageKeyFor,
  profileNameKeyFor,
  profileRoleKeyFor,
  adoptLegacyProfileKeys,
  readProfileValue,
  writeProfileValue,
} from '../../lib/profileStore';
import { recommendations } from '../../data/mockData';
import './Header.css';

/* Profile state (photo / name / role) is USER-SCOPED: every key carries
   the signed-in user's Supabase id, so account A's picture can never be
   read or overwritten by account B (profile-isolation spec §2/§3/§7).
   The key builders + legacy-key migration live in profileStore.js. */
const ROLES = ['Farmer', 'Business Man'];

/* Notification read-state key + seed. The notifications themselves come
   from the REAL recommendation data (mockData.js) — the same actionable
   alerts shown on the Improve page. Only the read/unread flags persist. */
const NOTIF_READ_KEY = 'krisiveda.notifRead';
const NOTIF_SEED_READ = [false, false, true, true, true]; // 2 unread

const NOTIF_META = {
  1: { icon: Bug, tone: 'danger', timeKey: 'notifTime1' },
  2: { icon: TrendingDown, tone: 'danger', timeKey: 'notifTime2' },
  3: { icon: FlaskConical, tone: 'success', timeKey: 'notifTime3' },
  4: { icon: TrendingUp, tone: 'info', timeKey: 'notifTime4' },
  5: { icon: Activity, tone: 'warning', timeKey: 'notifTime5' },
};

/* Every notification relates to the farm's production health → the Improve
   page is where these alerts are actionable. */
const NOTIF_TARGET = '/improve';

export default memo(function Header({ onMenuToggle }) {
  const { language, changeLanguage, languages, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { active: voiceActive, stop: stopVoiceMode } = useVoiceMode();
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [accountError, setAccountError] = useState('');
  /* Profile state starts EMPTY and is loaded per-identity by the effect
     below — never synchronously from a shared key at mount time. */
  const [profileImage, setProfileImage] = useState('');
  // Real identity ONLY: no demo-user fallback. A skipped/logged-out
  // visitor has no profile — authenticated controls stay hidden entirely.
  const [profileName, setProfileName] = useState('');
  // Role is ONLY what the user actually picked (stored). Empty default —
  // the app never assigns or displays a role the user didn't choose.
  const [profileRole, setProfileRole] = useState('');
  const [readMap, setReadMap] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NOTIF_READ_KEY));
      if (Array.isArray(saved) && saved.length === recommendations.length) return saved;
    } catch { /* corrupted seed → re-seed */ }
    return NOTIF_SEED_READ;
  });
  /* Panel anchor, measured ONCE per open (on the bell click) instead of on
     every render. Reading getBoundingClientRect during render forced a
     synchronous layout on each pass while the panel was open — the classic
     read-after-write thrash. Now the DOM is measured only when the panel
     actually opens, and the render just formats numbers. */
  const [notifAnchor, setNotifAnchor] = useState(null);
  const langRef = useRef(null);
  const notifRef = useRef(null);
  const notifPanelRef = useRef(null);
  const notifBtnRef = useRef(null);
  const fileRef = useRef(null);

  const currentLang = languages.find(l => l.code === language);
  /* Initials come ONLY from real information (auth name, else the name
     the user typed). Empty → the caller renders a neutral account icon. */
  const initials = (user?.name || profileName)
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const unreadCount = readMap.filter(r => !r).length;

  /* Auth-aware identity: signed-in users see their real account email in
     the profile window and their Google avatar when no photo was uploaded.
     The local profile name/role editing stays exactly as it was. */
  const authEmail = user?.email || '';
  const displayName = (isAuthenticated && user?.name) || profileName;

  /* ---------------- per-identity profile load (isolation core) ----------
     Spec §10: on identity change the state transitions
       User A → CLEAR → User B → LOAD B's OWN data.
     The in-memory photo/name/role ALWAYS starts empty here; only the
     current user's OWN scoped keys can repopulate it. Signed out, the
     state stays empty (neutral icon) and stray profile copies are
     purged. Signing in as A also migrates the pre-fix global keys into
     A's scope once, then deletes the shared copies. */
  const userId = user?.id || null;
  useEffect(() => {
    if (!userId) {
      // Signed out (or session lost): wipe memory so no photo/name/role
      // survives into the next identity (spec §9). Each account's OWN
      // scoped keys stay — they restore on that account's next login.
      setProfileImage('');
      setProfileName('');
      setProfileRole('');
      return;
    }
    // Signed in: state was (re)rendered empty; load ONLY this user's own
    // scoped values. The previous user's keys are never read.
    adoptLegacyProfileKeys(userId);
    setProfileImage(readProfileValue(profileImageKeyFor, userId) || '');
    setProfileName(readProfileValue(profileNameKeyFor, userId) || '');
    setProfileRole(readProfileValue(profileRoleKeyFor, userId) || '');
  }, [userId]);

  const handleSignOut = async () => {
    if (authLoading) return;
    setAccountError('');
    try {
      await signOut();
      setPanelOpen(false);
      navigate('/login'); // spec §11: land on the public page after logout
    } catch (err) {
      setAccountError(friendlyAuthError(err, 'sign out'));
    }
  };

  const persistRead = (next) => {
    setReadMap(next);
    localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(next));
  };

  /* Language dropdown: outside-click close (existing behaviour).
     PERF: the document listener only exists while the dropdown is open —
     no permanently-attached global mousedown handler for a menu that is
     closed 99% of the time. */
  useEffect(() => {
    if (!langOpen) return undefined;
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [langOpen]);

  /* Bell toggle — measures the anchor at click time (before the panel
     renders), so the open render stays free of layout reads. */
  const toggleNotifs = useCallback(() => {
    if (notifOpen) {
      setNotifOpen(false);
      return;
    }
    const r = notifBtnRef.current?.getBoundingClientRect();
    setNotifAnchor({
      x: Math.round((r?.left ?? 0) + (r?.width ?? 0) / 2),
      y: Math.round((r?.bottom ?? 0) + 6),
      right: Math.round(window.innerWidth - (r?.right ?? 0)),
    });
    setNotifOpen(true);
  }, [notifOpen]);

  /* Notification panel: outside-click + Escape close (spec §14).
     The panel is portaled to <body>, so it is NOT inside notifRef —
     close on any outside mousedown, but never when the click started
     on the bell (it toggles) or inside the panel itself. */
  useEffect(() => {
    if (!notifOpen) return;
    const handlePointer = (e) => {
      if (notifRef.current?.contains(e.target)) return;
      if (notifPanelRef.current?.contains(e.target)) return;
      setNotifOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  /* Close on resize/rotation so the measured anchor can never drift
     outside the viewport (mobile orientation change). */
  useEffect(() => {
    if (!notifOpen) return;
    const onResize = () => setNotifOpen(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [notifOpen]);

  /* Escape closes the profile modal (and any open editor) — standard modal UX. */
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setPanelOpen(false); setEditing(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  /* Lock page scroll while the modal is open (market-modal philosophy). */
  useEffect(() => {
    if (!panelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [panelOpen]);

  /* Session ended while the profile window was open — sign-out from the
     modal itself, a token revoked elsewhere, or expiry. Close it at once:
     a logged-out user must never see account actions (incl. Sign out). */
  useEffect(() => {
    if (panelOpen && !isAuthenticated) setPanelOpen(false);
  }, [panelOpen, isAuthenticated]);

  /* Notification click: mark read + navigate to the relevant feature (spec §9). */
  const openNotification = useCallback((index) => {
    if (readMap[index]) return;
    const next = readMap.map((r, i) => (i === index ? true : r));
    persistRead(next);
    setNotifOpen(false);
    navigate(NOTIF_TARGET);
  }, [readMap, navigate]);

  const markAllRead = () => {
    persistRead(readMap.map(() => true));
  };

  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError(t('common.profile.invalidImage'));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPhotoError(t('common.profile.photoTooLarge'));
      return;
    }
    if (!userId) {
      // No authenticated user → no profile upload (spec §14).
      setPhotoError(t('common.profile.nameUnavailable'));
      return;
    }
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setProfileImage(dataUrl);
      writeProfileValue(profileImageKeyFor, userId, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const startEditing = () => {
    setNameDraft(profileName);
    setRoleDraft(profileRole);
    setEditing(true);
  };

  const saveProfile = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) {
      setProfileName(trimmed);
      writeProfileValue(profileNameKeyFor, userId, trimmed);
    }
    setProfileRole(roleDraft);
    writeProfileValue(profileRoleKeyFor, userId, roleDraft);
    setEditing(false);
  };

  const closePanel = () => { setPanelOpen(false); setEditing(false); };

  return (
    <header className="header">
      <div className="header__left">
        <button className="header__menu-btn" onClick={onMenuToggle} aria-label={t("common.toggleMenu")}>
          <Menu size={20} />
        </button>
      </div>

      <div className="header__right">
        {voiceActive && (
          <button
            className="header__voice-btn"
            onClick={stopVoiceMode}
            aria-label={t("common.stopVoiceMode")}
            title={t("common.voiceModeActive")}
          >
            <Mic size={15} />
            <span className="header__voice-dot" />
          </button>
        )}
        <div className="header__lang" ref={langRef}>
          <button
            className="header__lang-btn"
            onClick={() => setLangOpen(!langOpen)}
          >
            <Globe size={16} />
            <span>{currentLang?.native}</span>
            <ChevronDown size={12} />
          </button>
          {langOpen && (
            <div className="header__lang-dropdown">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`header__lang-option ${lang.code === language ? 'header__lang-option--active' : ''}`}
                  onClick={() => { changeLanguage(lang.code); setLangOpen(false); }}
                >
                  <span>{lang.native}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="header__icon-btn" onClick={toggleTheme} aria-label={t("common.toggleTheme")}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notification bell — toggles the translucent notification panel.
            The red dot shows only while notifications are unread (spec §10). */}
        <div className="header__notif" ref={notifRef}>
          <button
            ref={notifBtnRef}
            className="header__icon-btn header__notification"
            onClick={toggleNotifs}
            aria-label={t("common.notifications")}
            aria-haspopup="true"
            aria-expanded={notifOpen}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="header__notification-dot" />}
          </button>

          {notifOpen && createPortal(
            <div
              ref={notifPanelRef}
              className="notif-panel"
              role="dialog"
              aria-label={t("common.notifications")}
              style={{
                /* Anchor precisely under the bell — values measured on the
                   click that opened the panel (never during render). */
                '--notif-x': `${notifAnchor?.x ?? 0}px`,
                '--notif-y': `${notifAnchor?.y ?? 0}px`,
                '--notif-right-offset': `${notifAnchor?.right ?? 0}px`,
              }}
            >
              <div className="notif-panel__head">
                <div className="notif-panel__head-text">
                  <h3 className="notif-panel__title">{t("common.notifications")}</h3>
                  {unreadCount > 0 && (
                    <span className="notif-panel__count">
                      {t("common.notifUnreadCount", { n: unreadCount })}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button className="notif-panel__mark-all" onClick={markAllRead}>
                    <CheckCheck size={13} />
                    <span>{t("common.markAllRead")}</span>
                  </button>
                )}
              </div>

              <div className="notif-panel__list">
                {recommendations.map((rec, i) => {
                  const meta = NOTIF_META[rec.id] || NOTIF_META[1];
                  const Icon = meta.icon;
                  const read = readMap[i];
                  return (
                    <button
                      key={rec.id}
                      className={`notif-card notif-card--${meta.tone} ${read ? 'notif-card--read' : ''}`}
                      onClick={() => openNotification(i)}
                    >
                      <span className="notif-card__icon">
                        <Icon size={14} />
                      </span>
                      <span className="notif-card__body">
                        <span className="notif-card__title">{rec.title}</span>
                        <span className="notif-card__desc">{rec.description}</span>
                        <span className="notif-card__time">
                          {!read && <span className="notif-card__dot" aria-hidden="true" />}
                          {t(`common.${meta.timeKey}`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Account area — the ONLY account control, driven by the real
            Supabase session. Logged out: a single "Add Account" button at
            the same top-right position (opens the existing authentication
            flow — log in, sign up, or Google). Logged in: the real user's
            avatar. No fake profiles, no placeholders. */}
        {!isAuthenticated && (
          <Link className="header__auth-btn header__auth-btn--primary" to="/login" title={t('nav.addAccount')}>
            <UserPlus size={14} />
            <span>{t('nav.addAccount')}</span>
          </Link>
        )}

        {/* Small circular header avatar — opens the LARGE floating profile
            window. Shows the uploaded photo, else the Google avatar, else
            initials. Only rendered while signed in. */}
        {isAuthenticated && (
          <button
            className="header__avatar"
            onClick={() => { setPanelOpen(true); setPhotoError(''); setAccountError(''); }}
            title={displayName}
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
          >
            {profileImage
              ? <img className="header__avatar-img" src={profileImage} alt={displayName} />
              : user?.avatarUrl
                ? <img className="header__avatar-img" src={user.avatarUrl} alt={displayName} referrerPolicy="no-referrer" />
                : initials
                  ? <span>{initials}</span>
                  : <User size={18} aria-hidden="true" />}
          </button>
        )}
      </div>

      {/* LARGE floating profile window — portal + backdrop + overlay +
          dialog, the same battle-tested architecture as the Market
          Intelligence modal (production-safe backdrop blur). The photo
          fills the window; name/role sit OVER it on a subtle gradient. */}
      {/* Gated on isAuthenticated too (not just the state flag): the
          moment the Supabase session becomes null the portal unmounts —
          no logged-out user can ever glimpse the Sign out control. */}
      {panelOpen && isAuthenticated && createPortal(
        <div className="profile-modal__portal">
          <div
            className="profile-modal__backdrop"
            onClick={closePanel}
            aria-hidden="true"
          />
          <div className="profile-modal__overlay">
            <div
              className="profile-modal__dialog"
              role="dialog"
              aria-modal="true"
              aria-label={t("settings.profile")}
            >
              {/* Hero photo — covers the whole window (spec §2). */}
              <div className="profile-modal__hero">
                {profileImage
                  ? <img src={profileImage} alt={displayName} />
                  : user?.avatarUrl
                    ? <img src={user.avatarUrl} alt={displayName} referrerPolicy="no-referrer" />
                    : initials
                      ? <span className="profile-modal__initials">{initials}</span>
                      : <User size={22} aria-hidden="true" />}
                <div className="profile-modal__scrim" aria-hidden="true" />

                {/* Circular close button, top-right (spec §7). */}
                <button
                  className="profile-modal__close"
                  onClick={closePanel}
                  aria-label="Close profile"
                >
                  <X size={16} />
                </button>

                {/* Circular camera button over the photo (spec §5). */}
                <button
                  className="profile-modal__photo-edit"
                  onClick={() => fileRef.current?.click()}
                  aria-label={t("common.profile.changePhoto")}
                  title={t("common.profile.changePhoto")}
                >
                  <Camera size={15} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  hidden
                  onChange={handlePhotoPick}
                />

                {editing ? (
                  <div className="profile-modal__editor">
                    <label className="profile-modal__field">
                      <span>{t("common.profile.editName")}</span>
                      <input
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        maxLength={40}
                      />
                    </label>
                    <span className="profile-modal__field-label">{t("common.profile.changeRole")}</span>
                    <div className="profile-modal__roles">
                      {ROLES.map(role => (
                        <button
                          key={role}
                          className={`profile-modal__role ${roleDraft === role ? 'profile-modal__role--active' : ''}`}
                          onClick={() => setRoleDraft(role)}
                        >
                          {role === 'Farmer' ? t("common.profile.farmer") : t("common.profile.businessMan")}
                        </button>
                      ))}
                    </div>
                    <div className="profile-modal__editor-actions">
                      <button className="profile-modal__pill profile-modal__pill--ghost" onClick={() => setEditing(false)}>
                        {t("common.profile.cancel")}
                      </button>
                      <button className="profile-modal__pill profile-modal__pill--primary" onClick={saveProfile}>
                        {t("common.profile.save")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-modal__identity">
                    <h3 className="profile-modal__name">{displayName || t("common.profile.nameUnavailable")}</h3>
                    {/* Signed-in account identity — real auth email only. */}
                    {authEmail && <p className="profile-modal__email">{authEmail}</p>}
                    {/* Role line ONLY when the user actually chose one. */}
                    {profileRole && (
                      <p className="profile-modal__role-line">
                        {profileRole === 'Business Man' ? t("common.profile.businessMan") : t("common.profile.farmer")}
                      </p>
                    )}
                    <div className="profile-modal__actions">
                      <button className="profile-modal__pill" onClick={startEditing}>
                        {t("common.profile.editProfile")}
                      </button>
                      <button
                        className="profile-modal__pill profile-modal__pill--signout"
                        onClick={handleSignOut}
                        disabled={authLoading}
                      >
                        <LogOut size={13} />
                        <span>{authLoading ? 'Signing out…' : 'Sign out'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {(photoError || accountError) && (
                  <p className="profile-modal__error">{photoError || accountError}</p>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
});
