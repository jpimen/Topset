import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthProvider';
import { MAX_TRAINING_VIDEO_BYTES, postAthleteTrainingVideo, trainingVideoLabels } from '../../lib/athlete/trainingVideos';

const uuidSchema = z.string().uuid();

export function AthletePostVideoPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const assignmentId = uuidSchema.safeParse(searchParams.get('assignmentId'));
  const dayId = uuidSchema.safeParse(searchParams.get('dayId'));
  const dayName = searchParams.get('dayName')?.trim() ?? '';
  const [label, setLabel] = useState<(typeof trainingVideoLabels)[number]>('Topset');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.currentTarget.files?.[0] ?? null);
    setError('');
    setNotice('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !assignmentId.success || !dayId.success || !dayName || !file) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      await postAthleteTrainingVideo({ athleteId: profile.id, assignmentId: assignmentId.data, dayId: dayId.data, dayName, label, file });
      setNotice(`${label} video posted for ${dayName}.`);
      setFile(null);
    } catch (cause) {
      console.error('Athlete training video could not be posted.', cause);
      const message = cause instanceof Error ? cause.message : '';
      setError(message.startsWith('Choose') || message.startsWith('The video')
        ? message
        : 'Your video could not be posted. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!assignmentId.success || !dayId.success || !dayName || dayName.length > 120) {
    return <main className="athlete-page"><section className="coach-panel empty-state" role="alert"><h1>Training day unavailable</h1><p>Open Post Video from a day in your assigned program to attach the video.</p><Link className="button button-secondary" to="/athlete/program">Back to your program</Link></section></main>;
  }

  return <main className="athlete-page">
    <header className="athlete-page-heading"><div><p className="eyebrow">POST VIDEO · {dayName.toUpperCase()}</p><h1>Share a training video</h1><p>Choose a label so your coach knows which part of the session the video shows.</p></div></header>
    <section className="coach-panel athlete-post-video-card" aria-labelledby="post-video-heading">
      <div className="panel-heading"><div><p className="eyebrow">{dayName}</p><h2 id="post-video-heading">Training video</h2></div></div>
      <form className="athlete-post-video-form" onSubmit={(event) => void submit(event)}>
        <label className="form-field" htmlFor="training-video-label">Video label<select id="training-video-label" value={label} onChange={(event) => setLabel(event.currentTarget.value as (typeof trainingVideoLabels)[number])}>{trainingVideoLabels.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        <label className="form-field" htmlFor="training-video-file">Video file<input id="training-video-file" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v" onChange={chooseFile} /> <span className="field-help">MP4, MOV, M4V, or WebM · up to 100 MB</span></label>
        {file && <div className="athlete-post-video-preview"><video src={previewUrl} controls playsInline preload="metadata">Video preview is not supported by this browser.</video><span>{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</span></div>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        {notice && <p className="inline-state" role="status">{notice}</p>}
        <div className="athlete-post-video-actions"><Link className="button button-secondary" to="/athlete/program">Back to program</Link><button className="button button-primary" type="submit" disabled={!file || uploading || !profile}>{uploading ? 'Posting video…' : 'Post video'}</button></div>
      </form>
    </section>
    <p className="field-help athlete-post-video-limit">Videos must be smaller than {MAX_TRAINING_VIDEO_BYTES / (1024 * 1024)} MB. Your upload is private to you and your currently linked coach.</p>
  </main>;
}
