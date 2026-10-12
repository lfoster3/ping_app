import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import type { Recording } from './MessagesProvider';

/** Anything shorter is almost certainly an accidental tap. */
const MIN_SECONDS = 0.6;

/**
 * expo-audio writes .m4a (AAC) on iOS/Android. In a browser it depends on the
 * engine (Chrome: WebM, Safari: MP4, Firefox: Ogg), so ask the blob itself.
 */
async function mimeTypeOf(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const type = (await (await fetch(uri)).blob()).type.split(';')[0];
    return type || 'audio/webm';
  }
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ext === 'wav' ? 'audio/wav' : ext === '3gp' ? 'audio/3gpp' : ext === 'webm' ? 'audio/webm' : 'audio/mp4';
}

/** Phone-mic stand-in for the band's record button: start, then stop() or cancel(). */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Ping needs microphone access to send voice notes.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t start recording.');
    }
  }, [recorder]);

  const finish = useCallback(
    async (keep: boolean): Promise<Recording | null> => {
      const durationSec = state.durationMillis / 1000;
      try {
        await recorder.stop();
      } finally {
        // While recording is allowed, iOS plays audio through the earpiece.
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      }
      const uri = recorder.uri;
      if (!keep || !uri || durationSec < MIN_SECONDS) return null;
      return { uri, mimeType: await mimeTypeOf(uri), durationSec: Math.round(durationSec * 10) / 10 };
    },
    [recorder, state.durationMillis],
  );

  return {
    recording: state.isRecording,
    durationSec: state.durationMillis / 1000,
    error,
    start,
    /** Stops and returns the recording to send (null if it was too short). */
    stop: () => finish(true),
    cancel: () => finish(false),
  };
}
