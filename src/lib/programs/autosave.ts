export interface DebouncedSave<T> {
  schedule: (value: T) => void;
  flush: () => Promise<void>;
  cancel: () => void;
}

export function createDebouncedSave<T>(save: (value: T) => Promise<void>, delay = 600): DebouncedSave<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: T | undefined;
  let pending: Promise<void> = Promise.resolve();

  const flush = async () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (latest === undefined) return pending;
    const value = latest;
    latest = undefined;
    pending = pending.catch(() => undefined).then(() => save(value));
    return pending;
  };

  return {
    schedule(value) {
      latest = value;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => void flush().catch(() => undefined), delay);
    },
    flush,
    cancel() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      latest = undefined;
    },
  };
}
