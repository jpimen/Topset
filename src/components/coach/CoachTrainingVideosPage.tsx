import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadProgram } from '../../lib/programs/repository';
import { TRAINING_VIDEO_BUCKET } from '../../lib/athlete/trainingVideos';
import { supabase } from '../../lib/supabase';
import { useCoachId } from './useCoachId';

type TrainingVideoRecord = {
  id: string;
  athlete_id: string;
  assignment_id: string;
  day_id: string;
  day_name: string;
  label: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  file_size: number;
  created_at: string;
};

type CoachTrainingVideo = TrainingVideoRecord & { athlete_name: string; signed_url: string | null };

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CoachTrainingVideosPage() {
  const { programId = '', dayId = '' } = useParams();
  const coachId = useCoachId();
  const [programName, setProgramName] = useState('');
  const [dayName, setDayName] = useState('');
  const [videos, setVideos] = useState<CoachTrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadVideos = async () => {
      setLoading(true);
      setError('');
      try {
        const db = supabase;
        if (!db) throw new Error('Supabase environment is not configured.');
        const program = await loadProgram(programId);
        const day = program.weeks.flatMap((week) => week.days).find((item) => item.id === dayId);
        if (!day) throw new Error('This training day is not part of the selected program.');
        if (active) { setProgramName(program.program.name); setDayName(day.name); }

        const { data: assignmentRows, error: assignmentError } = await db.from('program_assignments')
          .select('id').eq('program_id', programId).eq('coach_id', coachId).eq('status', 'active');
        if (assignmentError) throw assignmentError;
        const assignmentIds = (assignmentRows ?? []).map((row) => row.id);
        if (!assignmentIds.length) {
          if (active) setVideos([]);
          return;
        }

        const { data: videoRows, error: videoError } = await db.from('athlete_training_videos')
          .select('id, athlete_id, assignment_id, day_id, day_name, label, storage_path, file_name, content_type, file_size, created_at')
          .eq('day_id', dayId).in('assignment_id', assignmentIds).order('created_at', { ascending: false });
        if (videoError) throw videoError;
        const records = (videoRows ?? []) as TrainingVideoRecord[];
        const athleteIds = [...new Set(records.map((video) => video.athlete_id))];
        const { data: athleteRows, error: athleteError } = athleteIds.length
          ? await db.from('profiles').select('id, name').in('id', athleteIds)
          : { data: [], error: null };
        if (athleteError) throw athleteError;
        const athleteNames = new Map((athleteRows ?? []).map((athlete) => [athlete.id, athlete.name]));

        const signedVideos = await Promise.all(records.map(async (video): Promise<CoachTrainingVideo> => {
          const { data, error: signedUrlError } = await db.storage.from(TRAINING_VIDEO_BUCKET).createSignedUrl(video.storage_path, 3600);
          if (signedUrlError) console.error('Training video playback URL could not be created.', signedUrlError);
          return { ...video, athlete_name: athleteNames.get(video.athlete_id) ?? 'Athlete', signed_url: data?.signedUrl ?? null };
        }));
        if (active) setVideos(signedVideos);
      } catch (cause) {
        console.error('Coach training videos could not be loaded.', cause);
        if (active) setError('Videos could not be loaded. Check your connection and make sure the training video migration is applied.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadVideos();
    return () => { active = false; };
  }, [coachId, dayId, programId, reloadKey]);

  return <main className="coach-page coach-videos-page">
    <div className="builder-breadcrumb"><Link to={`/coach/programs/${programId}`}>← Program builder</Link><span>/</span><span>Videos</span></div>
    <header className="coach-videos-heading"><div><p className="eyebrow">{programName || 'PROGRAM'} / {dayName || 'TRAINING DAY'}</p><h1>Training videos</h1><p>Videos athletes have posted for this training day.</p></div><button className="button button-secondary" type="button" onClick={() => setReloadKey((current) => current + 1)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh videos'}</button></header>
    {error ? <section className="coach-panel empty-state" role="alert"><h2>Videos unavailable</h2><p>{error}</p><button className="button button-secondary" type="button" onClick={() => setReloadKey((current) => current + 1)}>Try again</button></section> : loading ? <div className="dashboard-skeleton" aria-label="Loading training videos" /> : videos.length === 0 ? <section className="coach-panel empty-state"><h2>No videos yet</h2><p>Videos posted by athletes for {dayName || 'this training day'} will appear here.</p></section> : <section className="coach-video-list" aria-label={`${dayName} training videos`}>
      {videos.map((video) => <article className="coach-panel coach-video-card" key={video.id}>
        <header><div><p className="eyebrow">{video.athlete_name}</p><h2>{video.label}</h2></div><time dateTime={video.created_at}>{new Date(video.created_at).toLocaleString()}</time></header>
        {video.signed_url ? <video controls playsInline preload="metadata" src={video.signed_url}>Video playback is not supported by this browser.</video> : <p className="inline-error" role="status">This video file is unavailable. Refresh to try again.</p>}
        <p className="coach-video-file-details"><span>{video.file_name}</span><span>{formatFileSize(video.file_size)}</span></p>
      </article>)}
    </section>}
  </main>;
}
