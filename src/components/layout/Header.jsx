import { Bell, Sun, Moon, ChevronDown, Globe, Menu, Mic, Camera, Pencil } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { useVoiceMode } from '../../hooks/useVoiceMode';
import { demoUser } from '../../data/mockData';
import './Header.css';

/* localStorage keys — shared by the header avatar and the profile panel
   (one profileImage state drives both, per the profile-panel spec). */
const PROFILE_IMAGE_KEY = 'krisiveda.profileImage';
const PROFILE_NAME_KEY = 'krisiveda.profileName';
const PROFILE_ROLE_KEY = 'krisiveda.profileRole';
const ROLES = ['Farmer', 'Business Man'];

export default function Header({ onMenuToggle }) {
  const { language, changeLanguage, languages, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { active: voiceActive, stop: stopVoiceMode } = useVoiceMode();
  const [langOpen, setLangOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem(PROFILE_IMAGE_KEY) || '');
  const [profileName, setProfileName] = useState(() => localStorage.getItem(PROFILE_NAME_KEY) || demoUser.name);
  const [profileRole, setProfileRole] = useState(() => localStorage.getItem(PROFILE_ROLE_KEY) || demoUser.role);
  const langRef = useRef(null);
  const panelRef = useRef(null);
  const fileRef = useRef(null);

  const currentLang = languages.find(l => l.code === language);
  const initials = profileName
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || demoUser.initials;

  useEffect(() => {
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = () => {
      setProfileImage(reader.result);
      localStorage.setItem(PROFILE_IMAGE_KEY, reader.result);
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
      localStorage.setItem(PROFILE_NAME_KEY, trimmed);
    }
    setProfileRole(roleDraft);
    localStorage.setItem(PROFILE_ROLE_KEY, roleDraft);
    setEditing(false);
  };

  return (
    <header className="header">
      <div className="header__left">
        <button className="header__menu-btn" onClick={onMenuToggle} aria-label={t("common.toggleMenu")}>
          <Menu size={20} />
        </button>
      </div>

      <div className="header__right">
        {/* Persistent Voice Mode indicator — click to stop */}
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
                  <span className="header__lang-flag">{lang.flag}</span>
                  <span>{lang.native}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="header__icon-btn" onClick={toggleTheme} aria-label={t("common.toggleTheme")}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="header__icon-btn header__notification" aria-label={t("common.notifications")}>
          <Bell size={18} />
          <span className="header__notification-dot" />
        </button>

        {/* Small circular header avatar — opens the floating profile panel.
            Shows the uploaded photo when present, else the initials. */}
        <div className="header__avatar-wrap" ref={panelRef}>
          <button
            className="header__avatar"
            onClick={() => { setPanelOpen(o => !o); setEditing(false); setPhotoError(''); }}
            title={profileName}
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
          >
            {profileImage
              ? <img className="header__avatar-img" src={profileImage} alt={profileName} />
              : <span>{initials}</span>}
          </button>

          {panelOpen && (
            <div className="profile-panel" role="dialog" aria-label={t("settings.profile")}>
              {/* Large identity photo — the panel's dominant visual. The
                  edit/camera button floats over its lower-right corner. */}
              <div className="profile-panel__photo">
                {profileImage
                  ? <img src={profileImage} alt={profileName} />
                  : <span className="profile-panel__initials">{initials}</span>}
                <button
                  className="profile-panel__photo-edit"
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
              </div>

              {photoError && <p className="profile-panel__error">{photoError}</p>}

              {editing ? (
                <div className="profile-panel__editor">
                  <label className="profile-panel__field">
                    <span>{t("common.profile.editName")}</span>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      maxLength={40}
                    />
                  </label>
                  <span className="profile-panel__field-label">{t("common.profile.changeRole")}</span>
                  <div className="profile-panel__roles">
                    {ROLES.map(role => (
                      <button
                        key={role}
                        className={`profile-panel__role ${roleDraft === role ? 'profile-panel__role--active' : ''}`}
                        onClick={() => setRoleDraft(role)}
                      >
                        {role === 'Farmer' ? t("common.profile.farmer") : t("common.profile.businessMan")}
                      </button>
                    ))}
                  </div>
                  <div className="profile-panel__actions">
                    <button className="profile-panel__btn profile-panel__btn--ghost" onClick={() => setEditing(false)}>
                      {t("common.profile.cancel")}
                    </button>
                    <button className="profile-panel__btn profile-panel__btn--primary" onClick={saveProfile}>
                      {t("common.profile.save")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="profile-panel__name">{profileName}</h3>
                  <p className="profile-panel__role-line">
                    {profileRole === 'Business Man' ? t("common.profile.businessMan") : t("common.profile.farmer")}
                  </p>
                  <button className="profile-panel__edit" onClick={startEditing}>
                    <Pencil size={14} />
                    {t("common.profile.editProfile")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
