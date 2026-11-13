import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { AthleteCoachLinkCard } from './AthleteCoachLinkCard';
import { ThemeToggle } from '../ThemeToggle';

function parseOneRepMax(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 2000 ? parsed : undefined;
}

export function AthleteSettingsPage() {
  return <main className="athlete-page">
    <header className="athlete-page-heading"><div><p className="eyebrow">SETTINGS</p><h1>Settings</h1><p>Personalize your athlete workspace.</p></div></header>
    <section className="coach-panel theme-toggle-settings" aria-labelledby="athlete-appearance-heading">
      <div className="appearance-setting-row">
        <div className="appearance-setting-copy"><h2 id="athlete-appearance-heading">Appearance</h2><p>Choose the display theme for this device.</p></div>
        <ThemeToggle />
      </div>
    </section>
  </main>;
}

export function AthleteProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState('');
  const [category, setCategory] = useState('');
  const [weightClass, setWeightClass] = useState('');
  const [teamName, setTeamName] = useState('');
  const [achievements, setAchievements] = useState('');
  const [squatMax, setSquatMax] = useState('');
  const [benchMax, setBenchMax] = useState('');
  const [deadliftMax, setDeadliftMax] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? '');
    setCategory(profile.category ?? '');
    setWeightClass(profile.weight_class ?? '');
    setTeamName(profile.team_name ?? '');
    setAchievements(profile.achievements ?? '');
    setSquatMax(profile.squat_max === null ? '' : String(profile.squat_max));
    setBenchMax(profile.bench_max === null ? '' : String(profile.bench_max));
    setDeadliftMax(profile.deadlift_max === null ? '' : String(profile.deadlift_max));
  }, [profile]);

  useEffect(() => {
    let active = true;
    const loadPhoto = async () => {
      if (!profile?.profile_photo_path || !supabase) {
        setPhotoUrl(null);
        return;
      }
      const { data, error: photoError } = await supabase.storage.from('athlete-profile-photos').createSignedUrl(profile.profile_photo_path, 3600);
      if (!active) return;
      if (photoError) {
        console.error('Athlete profile photo could not be loaded.', photoError);
        setPhotoUrl(null);
      } else setPhotoUrl(data.signedUrl);
    };
    void loadPhoto();
    return () => { active = false; };
  }, [profile?.profile_photo_path]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !supabase) return;
    const squat = parseOneRepMax(squatMax);
    const bench = parseOneRepMax(benchMax);
    const deadlift = parseOneRepMax(deadliftMax);
    if (squat === undefined || bench === undefined || deadlift === undefined) {
      setError('Enter each 1RM as a number greater than 0 and no more than 2,000.');
      setNotice('');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { error: updateError } = await supabase.from('profiles').update({
        bio: bio.trim() || null,
        category: category.trim() || null,
        weight_class: weightClass.trim() || null,
        team_name: teamName.trim() || null,
        achievements: achievements.trim() || null,
        squat_max: squat,
        bench_max: bench,
        deadlift_max: deadlift,
      }).eq('id', profile.id);
      if (updateError) throw updateError;
      await refreshProfile();
      setNotice('Profile saved.');
    } catch (cause) {
      console.error('Athlete profile could not be saved.', cause);
      setError('Your profile could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !profile || !supabase) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose an image smaller than 5 MB.');
      return;
    }
    setUploading(true);
    setError('');
    setNotice('');
    const oldPath = profile.profile_photo_path;
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
    const newPath = `${profile.id}/${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('athlete-profile-photos').upload(newPath, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('profiles').update({ profile_photo_path: newPath }).eq('id', profile.id);
      if (updateError) {
        await supabase.storage.from('athlete-profile-photos').remove([newPath]);
        throw updateError;
      }
      await refreshProfile();
      if (oldPath) {
        const { error: removeError } = await supabase.storage.from('athlete-profile-photos').remove([oldPath]);
        if (removeError) console.error('Old athlete profile photo could not be removed.', removeError);
      }
      setNotice('Profile photo updated.');
    } catch (cause) {
      console.error('Athlete profile photo could not be uploaded.', cause);
      setError('Your photo could not be uploaded. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!profile) return <main className="athlete-page"><div className="dashboard-skeleton" aria-label="Loading your profile" /></main>;
  return (
    <main className="athlete-page">
      <header className="athlete-page-heading"><div><p className="eyebrow">PROFILE</p><h1>Your athlete profile</h1><p>Share your lifting background and competition details with your coach.</p></div></header>
      <section className="coach-panel athlete-profile-card">
        {photoUrl ? <img className="athlete-profile-photo" src={photoUrl} alt={`${profile.name} profile`} /> : <span className="user-avatar athlete-profile-photo-fallback" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>}
        <div><p className="eyebrow">ATHLETE</p><h2>{profile.name}</h2><p className="athlete-profile-subtitle">{category || 'Add your category'}{weightClass ? ` · ${weightClass}` : ''}</p></div>
        <label className="button button-secondary athlete-photo-upload">{uploading ? 'Uploading…' : photoUrl ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload athlete profile picture" onChange={(event) => void uploadPhoto(event)} disabled={uploading} /></label>
      </section>
      <section className="coach-panel athlete-profile-details" aria-labelledby="athlete-details-heading">
        <div className="panel-heading"><div><p className="eyebrow">YOUR DETAILS</p><h2 id="athlete-details-heading">Training profile</h2></div></div>
        <p className="athlete-profile-help">Your linked coach can see these details. Keep personal information relevant to your training.</p>
        <form className="athlete-profile-form" onSubmit={(event) => void saveProfile(event)}>
          <label className="form-field">Bio<textarea rows={3} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A little about your training background" /></label>
          <div className="athlete-profile-form-row">
            <label className="form-field">Category / division<input maxLength={60} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Open, Junior, Masters…" /></label>
            <label className="form-field">Weight class<input maxLength={30} value={weightClass} onChange={(event) => setWeightClass(event.target.value)} placeholder="e.g. 76 kg" /></label>
          </div>
          <div className="athlete-profile-maxes">
            <div className="athlete-profile-maxes-heading"><div><p className="eyebrow">LIFTING NUMBERS</p><h3>Current one rep maxes</h3></div><span className="field-help">All weights in {profile.unit ?? 'kg'}.</span></div>
            <div className="athlete-profile-form-row athlete-profile-maxes-row">
              <label className="form-field">Squat 1RM ({profile.unit ?? 'kg'})<input type="number" min="0.01" max="2000" step="0.01" value={squatMax} onChange={(event) => setSquatMax(event.target.value)} placeholder="e.g. 180" /></label>
              <label className="form-field">Bench 1RM ({profile.unit ?? 'kg'})<input type="number" min="0.01" max="2000" step="0.01" value={benchMax} onChange={(event) => setBenchMax(event.target.value)} placeholder="e.g. 110" /></label>
              <label className="form-field">Deadlift 1RM ({profile.unit ?? 'kg'})<input type="number" min="0.01" max="2000" step="0.01" value={deadliftMax} onChange={(event) => setDeadliftMax(event.target.value)} placeholder="e.g. 220" /></label>
            </div>
            <p className="field-help">Your linked coach can see these numbers.</p>
          </div>
          <label className="form-field">Team or gym<input maxLength={100} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team or gym name" /></label>
          <label className="form-field">Achievements<textarea rows={4} maxLength={1500} value={achievements} onChange={(event) => setAchievements(event.target.value)} placeholder="Meets, placements, personal milestones…" /></label>
          {error && <p className="inline-error" role="alert">{error}</p>}
          {notice && <p className="inline-state" role="status">{notice}</p>}
          <div className="athlete-profile-save-row"><span className="field-help">Profile pictures: JPG, PNG, or WebP up to 5 MB.</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      </section>
      <AthleteCoachLinkCard />
    </main>
  );
}
