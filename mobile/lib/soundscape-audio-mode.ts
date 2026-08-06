export type SoundscapeAudioMode = {
  allowsRecordingIOS?: boolean;
  playsInSilentModeIOS: boolean;
  staysActiveInBackground: boolean;
  shouldDuckAndroid?: boolean;
};

type SetAudioMode = (mode: SoundscapeAudioMode) => Promise<void>;
type Wait = (milliseconds: number) => Promise<void>;

const defaultWait: Wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createSoundscapeAudioModeCoordinator(
  setAudioMode: SetAudioMode,
  wait: Wait = defaultWait
) {
  let activeOwner: symbol | null = null;
  let updateQueue = Promise.resolve();

  const enqueue = (operation: () => Promise<void>) => {
    const result = updateQueue.then(operation, operation);
    updateQueue = result.catch(() => undefined);
    return result;
  };

  const enable = (owner: symbol, backgroundPlayback: boolean) => {
    activeOwner = owner;
    return enqueue(async () => {
      if (activeOwner !== owner) return;
      try {
        await setAudioMode({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: backgroundPlayback,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        if (activeOwner === owner) activeOwner = null;
        throw error;
      }
    });
  };

  const release = (owner: symbol) => {
    if (activeOwner !== owner) return Promise.resolve();
    activeOwner = null;

    return enqueue(async () => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (activeOwner !== null) return;
        try {
          await setAudioMode({
            playsInSilentModeIOS: false,
            staysActiveInBackground: false,
          });
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 2) await wait(50 * (attempt + 1));
        }
      }
      throw lastError;
    });
  };

  return { enable, release };
}
