import { z } from 'zod';
import { Upload } from 'tus-js-client';
import { supabase } from '../supabase';

export const TRAINING_VIDEO_BUCKET = 'athlete-training-videos';
export const MAX_TRAINING_VIDEO_BYTES = 50_000_000_000;

export const trainingVideoLabels = [
  'Topset', '1st set', '2nd set', '3rd set', '4th set', '5th set', '6th set', '7th set', '8th set', '9th set', '10th set',
  '11th set', '12th set', '13th set', '14th set', '15th set', '16th set', '17th set', '18th set', '19th set', '20th set',
] as const;

const videoContentTypes: Record<string, { contentType: string; extension: string }> = {
  'video/mp4': { contentType: 'video/mp4', extension: 'mp4' },
  'video/quicktime': { contentType: 'video/quicktime', extension: 'mov' },
  'video/webm': { contentType: 'video/webm', extension: 'webm' },
  'video/x-m4v': { contentType: 'video/x-m4v', extension: 'm4v' },
};

const extensionTypes: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v' };

const trainingVideoDraftSchema = z.object({
  athleteId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  dayId: z.string().uuid(),
  dayName: z.string().trim().min(1).max(120),
  label: z.enum(trainingVideoLabels),
});

export async function postAthleteTrainingVideo(input: {
  athleteId: string;
  assignmentId: string;
  dayId: string;
  dayName: string;
  label: string;
  file: File;
  onProgress?: (percentage: number) => void;
}): Promise<void> {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  const draft = trainingVideoDraftSchema.parse(input);
  if (input.file.size <= 0 || input.file.size > MAX_TRAINING_VIDEO_BYTES) {
    throw new Error('Choose a video no larger than 50 GB.');
  }
  const extension = input.file.name.split('.').pop()?.toLowerCase() ?? '';
  const declaredType = extension === 'm4v' && input.file.type === 'video/mp4'
    ? 'video/x-m4v'
    : input.file.type || extensionTypes[extension];
  const media = declaredType ? videoContentTypes[declaredType] : undefined;
  const matchingType = input.file.type === media?.contentType || (extension === 'm4v' && input.file.type === 'video/mp4');
  if (!media || (input.file.type && !matchingType)) {
    throw new Error('Choose an MP4, MOV, M4V, or WebM video.');
  }
  if (extension !== media.extension && !(media.extension === 'mp4' && extension === 'm4v')) {
    throw new Error('The video file extension does not match its format.');
  }

  const videoId = crypto.randomUUID();
  const storagePath = `${draft.athleteId}/${draft.assignmentId}/${draft.dayId}/${videoId}.${media.extension}`;
  const row = {
    id: videoId,
    athlete_id: draft.athleteId,
    assignment_id: draft.assignmentId,
    day_id: draft.dayId,
    day_name: draft.dayName,
    label: draft.label,
    storage_path: storagePath,
    file_name: input.file.name.slice(0, 255),
    content_type: media.contentType,
    file_size: input.file.size,
  };

  const { error: rowError } = await supabase.from('athlete_training_videos').insert(row);
  if (rowError) throw rowError;

  try {
    const [{ data: sessionResult, error: sessionError }, projectUrl] = await Promise.all([
      supabase.auth.getSession(),
      Promise.resolve(new URL(import.meta.env.VITE_SUPABASE_URL)),
    ]);
    if (sessionError) throw sessionError;
    if (!sessionResult.session) throw new Error('Your session expired. Sign in again and retry the upload.');

    const projectHost = projectUrl.hostname.match(/^([^.]+)\.supabase\.co$/);
    const uploadOrigin = projectHost
      ? `https://${projectHost[1]}.storage.supabase.co`
      : projectUrl.origin;
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(input.file, {
        endpoint: `${uploadOrigin}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${sessionResult.session!.access_token}` },
        onBeforeRequest: async (request) => {
          const { data, error } = await supabase!.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error('Your session expired. Sign in again and retry the upload.');
          request.setHeader('authorization', `Bearer ${data.session.access_token}`);
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        fingerprint: async () => `${storagePath}:${input.file.name}:${input.file.size}:${input.file.lastModified}`,
        chunkSize: 6 * 1024 * 1024,
        metadata: {
          bucketName: TRAINING_VIDEO_BUCKET,
          objectName: storagePath,
          contentType: media.contentType,
          cacheControl: '3600',
        },
        onError: reject,
        onProgress: (uploaded, total) => input.onProgress?.(Math.floor((uploaded / total) * 100)),
        onSuccess: () => resolve(),
      });
      void upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      }).catch(reject);
    });
  } catch (uploadError) {
    const { error: cleanupError } = await supabase.from('athlete_training_videos').delete().eq('id', videoId);
    if (cleanupError) console.error('Failed to remove video metadata after its upload failed.', cleanupError);
    throw uploadError;
  }
}
