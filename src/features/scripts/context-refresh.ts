export function createContextRefresh(refresh: (isCurrent: () => boolean) => Promise<void>): {
  schedule(): void;
  dispose(): void;
} {
  let generation = 0;
  let disposed = false;

  return {
    schedule: () => {
      if (disposed) return;
      const currentGeneration = ++generation;
      void refresh(() => !disposed && currentGeneration === generation).catch((error: unknown) => {
        if (!disposed && currentGeneration === generation) {
          console.error('Unable to refresh script contexts.', error);
        }
      });
    },
    dispose: () => {
      disposed = true;
      generation += 1;
    },
  };
}
