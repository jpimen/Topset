import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { CoachPageHeader } from './CoachPageHeader';

const photoBucket = 'athlete-profile-photos';
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

interface CoachProfileDraft {
  name: string;
  teamName: string;
  bio: string;
  category: string;
  achievements: string;
}

function toDraft(profile: NonNullable<ReturnType<typeof useAuth>['profile']>): CoachProfileDraft {
  return {
    name: profile.name,
    teamName: profile.team_name ?? '',
    bio: profile.bio ?? '',
    category: profile.category ?? '',
    achievements: profile.achievements ?? '',
  };
}

function savedValue(value: string | null | undefined) {
  return value?.trim() || 'Not added';
}

export function CoachProfilePage() {
  const { profile, session, loading, profileError, refreshProfile } = useAuth();
  const [savedProfile, setSavedProfile] = useState(profile);
  const [draft, setDraft] = useState<CoachProfileDraft | null>(profile ? toDraft(profile) : null);
  const [editing, setEditing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!profile || editing) return;
    setSavedProfile(profile);
    setDraft(toDraft(profile));
  }, [profile, editing]);

  useEffect(() => {
    let active = true;
    if (!profile?.profile_photo_path || !supabase) {
      setPhotoUrl(null);
      setPhotoLoading(false);
      setPhotoLoadError('');
      return () => { active = false; };
    }
    setPhotoLoading(true);
    setPhotoLoadError('');
    void supabase.storage.from(photoBucket).createSignedUrl(profile.profile_photo_path, 3600).then(({ data, error: signedUrlError }) => {
      if (!active) return;
      if (signedUrlError) throw signedUrlError;
      setPhotoUrl(data.signedUrl);
    }).catch((cause: unknown) => {
      if (!active) return;
      console.error('Coach profile photo could not be loaded.', cause);
      setPhotoUrl(null);
      setPhotoLoadError('Your profile photo could not be loaded.');
    }).finally(() => { if (active) setPhotoLoading(false); });
    return () => { active = false; };
  }, [profile?.profile_photo_path]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  const beginEdit = () => {
    if (!savedProfile) return;
    setDraft(toDraft(savedProfile));
    setPhotoFile(null);
    setError('');
    setNotice('');
    setEditing(true);
  };

  const cancelEdit = () => {
    if (savedProfile) setDraft(toDraft(savedProfile));
    setPhotoFile(null);
    setError('');
    setNotice('');
    setEditing(false);
  };

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!allowedPhotoTypes.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose an image smaller than 5 MB.');
      return;
    }
    setError('');
    setPhotoFile(file);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !savedProfile || !draft || !supabase) return;
    const name = draft.name.trim();
    if (name.length < 2 || name.length > 80) {
      setError('Name must be between 2 and 80 characters.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    let uploadedPath: string | null = null;
    let profileUpdated = false;
    const previousPhotoPath = savedProfile.profile_photo_path;
    try {
      if (photoFile) {
        const extension = photoFile.type === 'image/jpeg' ? 'jpg' : photoFile.type === 'image/png' ? 'png' : 'webp';
        uploadedPath = `${profile.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(photoBucket).upload(uploadedPath, photoFile, {
          contentType: photoFile.type,
          cacheControl: '3600',
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }

      const profileUpdate = {
        name,
        team_name: draft.teamName.trim() || null,
        bio: draft.bio.trim() || null,
        category: draft.category.trim() || null,
        achievements: draft.achievements.trim() || null,
        ...(uploadedPath ? { profile_photo_path: uploadedPath } : {}),
      };
      const { data, error: updateError } = await supabase.from('profiles')
        .update(profileUpdate)
        .eq('id', profile.id)
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('The signed-in profile was not updated.');
      profileUpdated = true;

      const nextProfile = { ...savedProfile, ...profileUpdate, profile_photo_path: uploadedPath ?? savedProfile.profile_photo_path };
      setSavedProfile(nextProfile);
      setDraft(toDraft(nextProfile));
      await refreshProfile();

      let photoCleanupFailed = false;
      if (uploadedPath) {
        try {
          const { data: signedData, error: signedError } = await supabase.storage.from(photoBucket).createSignedUrl(uploadedPath, 3600);
          if (signedError) throw signedError;
          setPhotoUrl(signedData.signedUrl);
          setPhotoLoadError('');
        } catch (cause) {
          console.error('Saved Coach profile photo could not be displayed.', cause);
          setPhotoUrl(null);
          setPhotoLoadError('Your profile saved, but the new photo could not be displayed.');
        }
        if (previousPhotoPath) {
          try {
            const { error: removeError } = await supabase.storage.from(photoBucket).remove([previousPhotoPath]);
            if (removeError) throw removeError;
          } catch (cause) {
            console.error('Old Coach profile photo could not be removed.', cause);
            photoCleanupFailed = true;
          }
        }
      }

      setPhotoFile(null);
      setEditing(false);
      setNotice(photoCleanupFailed ? 'Profile saved. The previous photo could not be removed.' : 'Profile saved.');
    } catch (cause) {
      if (uploadedPath && !profileUpdated) {
        try {
          const { error: cleanupError } = await supabase.storage.from(photoBucket).remove([uploadedPath]);
          if (cleanupError) console.error('Uncommitted Coach profile photo could not be removed.', cleanupError);
        } catch (cleanupCause) {
          console.error('Uncommitted Coach profile photo could not be removed.', cleanupCause);
        }
      }
      console.error('Coach profile could not be saved.', cause);
      setError('Your profile could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile || !savedProfile || !draft) {
    return <main className="coach-page">
      <CoachPageHeader eyebrow="COACH WORKSPACE / PROFILE" title="Your profile" description="Manage the profile information for your Coach account." />
      <section className="coach-panel coach-profile-state" role={loading ? 'status' : 'alert'}>
        {loading ? <><span className="spinner" />Loading your profile…</> : <><p>{profileError ?? 'Your profile is not available.'}</p><button type="button" className="button button-secondary" onClick={() => void refreshProfile()}>Try again</button></>}
      </section>
    </main>;
  }

  const displayedPhoto = editing && photoPreview ? photoPreview : photoUrl;
  const email = session?.user.email?.trim() || 'Not available';

  return <main className="coach-page coach-profile-page">
    <CoachPageHeader eyebrow="COACH WORKSPACE / PROFILE" title="Your profile" description="Review the information associated with your Coach account." actions={editing ? <button type="button" className="button button-secondary" onClick={cancelEdit} disabled={saving}>Cancel</button> : <button type="button" className="button button-secondary" onClick={beginEdit}>Edit profile</button>} />
    {notice && <p className="inline-state coach-profile-feedback" role="status">{notice}</p>}
    {error && <p className="inline-error coach-profile-feedback" role="alert">{error}</p>}
    {photoLoadError && <p className="inline-error coach-profile-feedback" role="alert">{photoLoadError}</p>}
    <section className="coach-panel coach-profile-card" aria-label="Coach account">
      {displayedPhoto ? <img className="coach-profile-photo" src={displayedPhoto} alt={`${savedProfile.name} profile`} /> : <span className="coach-profile-photo coach-profile-photo-fallback" aria-hidden="true">{savedProfile.name.slice(0, 1).toUpperCase()}</span>}
      <div className="coach-profile-identity"><p className="eyebrow">COACH ACCOUNT</p><h2>{editing && draft ? draft.name || 'Your name' : savedProfile.name}</h2><p>{email}</p></div>
      {editing && <label className="button button-secondary coach-profile-photo-upload">{photoLoading ? 'Loading photo…' : photoFile ? 'Choose a different photo' : savedProfile.profile_photo_path ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload Coach profile photo" onChange={choosePhoto} disabled={saving} /></label>}
    </section>

    {editing ? <section className="coach-panel coach-profile-details" aria-labelledby="coach-profile-edit-heading">
      <div className="panel-heading"><div><p className="eyebrow">PROFILE DETAILS</p><h2 id="coach-profile-edit-heading">Edit profile</h2></div></div>
      <p className="coach-profile-readonly"><span>Email</span><strong>{email}</strong><small>Email changes are managed by your sign-in provider.</small></p>
      <form className="coach-profile-form" onSubmit={(event) => void saveProfile(event)}>
        <div className="coach-profile-form-row">
          <label className="form-field">Full name<input required minLength={2} maxLength={80} autoComplete="name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })} /></label>
          <label className="form-field">Team or gym<input maxLength={100} autoComplete="organization" value={draft.teamName} onChange={(event) => setDraft({ ...draft, teamName: event.currentTarget.value })} placeholder="Optional" /></label>
          <label className="form-field">Category or discipline<input maxLength={60} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.currentTarget.value })} placeholder="e.g. Powerlifting coach" /></label>
        </div>
        <label className="form-field">Bio<textarea rows={3} maxLength={500} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.currentTarget.value })} placeholder="Coaching background or approach" /></label>
        <label className="form-field">Achievements<textarea rows={4} maxLength={1500} value={draft.achievements} onChange={(event) => setDraft({ ...draft, achievements: event.currentTarget.value })} placeholder="Meets, qualifications, or milestones" /></label>
        <div className="coach-profile-form-footer"><span className="field-help">Profile photo: JPG, PNG, or WebP up to 5 MB.</span><div><button type="button" className="button button-secondary" onClick={cancelEdit} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div></div>
      </form>
    </section> : <section className="coach-panel coach-profile-details" aria-labelledby="coach-profile-details-heading">
      <div className="panel-heading"><div><p className="eyebrow">PROFILE DETAILS</p><h2 id="coach-profile-details-heading">About you</h2></div></div>
      <dl className="coach-profile-values">
        <div><dt>Email</dt><dd>{email}</dd></div>
        <div><dt>Team or gym</dt><dd>{savedValue(savedProfile.team_name)}</dd></div>
        <div><dt>Category or discipline</dt><dd>{savedValue(savedProfile.category)}</dd></div>
        <div><dt>Bio</dt><dd>{savedValue(savedProfile.bio)}</dd></div>
        <div><dt>Achievements</dt><dd>{savedValue(savedProfile.achievements)}</dd></div>
      </dl>
    </section>}
  </main>;
}
