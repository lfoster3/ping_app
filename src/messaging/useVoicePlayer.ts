import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';

import type { Message, VoiceNote } from '@/data/types';
import { useMessages } from './MessagesProvider';

/** One player per conversation; starting a note stops whichever was playing. */
export function useVoicePlayer() {
  const { audioUrl } = useMessages();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Play through the speaker even with the iPhone's silent switch on.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Rewind at the end so the next tap plays it again from the start.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish, player]);

  const toggle = useCallback(
    async (message: Message & { body: VoiceNote }) => {
      setError(null);
      if (activeId === message.id) {
        if (status.playing) player.pause();
        else player.play();
        return;
      }
      try {
        const url = await audioUrl(message.body);
        if (!url) return;
        player.replace({ uri: url });
        player.play();
        setActiveId(message.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Couldn’t play that voice note.');
      }
    },
    [activeId, audioUrl, player, status.playing],
  );

  /** 0–1 through the given note, using its recorded length when the file doesn't say. */
  const progress = (message: Message & { body: VoiceNote }) => {
    if (message.id !== activeId) return 0;
    const total = status.duration || message.body.durationSec;
    return total > 0 ? Math.min(1, status.currentTime / total) : 0;
  };

  return {
    toggle,
    progress,
    isPlaying: (id: string) => id === activeId && status.playing,
    error,
  };
}
