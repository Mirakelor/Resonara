import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  LyricsResponse,
  Track,
} from "@resonara/contracts";
import {
  getLyricsCache,
  setLyricsCache,
} from "../../db/repositories/cache";
import { getSettings } from "../../db/repositories/settings";
import { resolveFreshPlaybackUrl } from "../../recommendation/verifyPlayable";
import { createNeteaseProvider } from "../../services/netease/client";
import type { AudioEngine } from "./AudioEngine";
import {
  getActiveLyricIndex,
  parseLyricsResponse,
} from "./lyrics";
import { WebAudioEngine } from "./webAudioEngine";

type PlayerOptions = {
  queue: Track[];
  engine?: AudioEngine;
  resolvePlaybackUrl?: (trackId: string) => Promise<string | null>;
  loadLyrics?: (trackId: string) => Promise<LyricsResponse | null>;
  onNotice?: (message: string) => void;
  onPlaybackStarted?: (track: Track) => void;
  onPlaybackCompleted?: (track: Track) => void;
};

async function defaultResolvePlaybackUrl(trackId: string) {
  const settings = await getSettings();
  const result = await resolveFreshPlaybackUrl(
    trackId,
    createNeteaseProvider(settings),
  );
  return result?.url ?? null;
}

async function defaultLoadLyrics(
  trackId: string,
): Promise<LyricsResponse | null> {
  const cached = await getLyricsCache(trackId);
  if (cached && typeof cached === "object") {
    const value = cached as Partial<LyricsResponse>;
    if (typeof value.hasLyrics === "boolean") {
      return value as LyricsResponse;
    }
  }

  const settings = await getSettings();
  const response = await createNeteaseProvider(settings).getLyrics(trackId);
  const value: LyricsResponse = {
    originalLrc: response.originalLrc,
    translationLrc: response.translationLrc,
    richLyrics: response.richLyrics,
    offsetMs: response.offsetMs,
    hasLyrics: response.hasLyrics,
  };
  await setLyricsCache(
    trackId,
    value,
    new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
  );
  return value;
}

export function usePlayerController({
  queue,
  engine: providedEngine,
  resolvePlaybackUrl = defaultResolvePlaybackUrl,
  loadLyrics = defaultLoadLyrics,
  onNotice,
  onPlaybackStarted,
  onPlaybackCompleted,
}: PlayerOptions) {
  const engine = useMemo(
    () => providedEngine ?? new WebAudioEngine(),
    [providedEngine],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<ReturnType<
    typeof parseLyricsResponse
  > | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const requestId = useRef(0);
  const preResolved = useRef(new Map<string, string>());
  const loadedTrackId = useRef<string | null>(null);
  const nextRef = useRef<() => Promise<void>>(async () => {});
  const currentTrackRef = useRef<Track | null>(null);

  const currentTrack = queue[currentIndex] ?? null;

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    engine.onTimeUpdate = (time, total) => {
      setCurrentTime(time);
      setDuration(total);
    };
    engine.onPlayStateChange = (paused) => setIsPlaying(!paused);
    engine.onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (currentTrackRef.current) {
        onPlaybackCompleted?.(currentTrackRef.current);
      }
      void nextRef.current();
    };
    engine.onError = (message) => onNotice?.(message);
    return () => engine.dispose();
  }, [engine, onNotice, onPlaybackCompleted]);

  useEffect(() => {
    if (currentIndex >= queue.length) setCurrentIndex(0);
  }, [currentIndex, queue.length]);

  const loadTrackLyrics = useCallback(
    async (trackId: string) => {
      setLyrics(null);
      try {
        const response = await loadLyrics(trackId);
        if (!response) return;
        const parsed = parseLyricsResponse(response);
        setLyrics(parsed.hasLyrics ? parsed : null);
        setLyricsOpen(response.hasLyrics);
      } catch {
        setLyrics(null);
      }
    },
    [loadLyrics],
  );

  const playTrack = useCallback(
    async (track: Track) => {
      const start = async (candidate: Track, attempt: number) => {
        const id = ++requestId.current;
        const index = queue.findIndex(
          (queued) => queued.id === candidate.id,
        );
        setCurrentIndex(index >= 0 ? index : 0);
        setCurrentTime(0);
        setDuration(0);
        setLyrics(null);
        void loadTrackLyrics(candidate.id);

        const advance = async () => {
          if (queue.length <= 1 || attempt >= queue.length - 1) return;
          const nextIndex = ((index >= 0 ? index : 0) + 1) % queue.length;
          const nextTrack = queue[nextIndex];
          if (nextTrack && nextTrack.id !== candidate.id) {
            await start(nextTrack, attempt + 1);
          }
        };

        try {
          const resolved = await resolvePlaybackUrl(candidate.id);
          if (id !== requestId.current) return;
          if (!resolved) {
            onNotice?.("This track has no anonymous playback URL right now.");
            await advance();
            return;
          }
          preResolved.current.delete(candidate.id);
          loadedTrackId.current = candidate.id;
          engine.load(resolved);
          await engine.play();
          if (id !== requestId.current) return;
          setIsPlaying(true);
          onPlaybackStarted?.(candidate);

          const nextIndex = (index + 1) % queue.length;
          const nextTrack = queue[nextIndex];
          if (nextTrack && nextTrack.id !== candidate.id) {
            void resolvePlaybackUrl(nextTrack.id).then((url) => {
              if (url) preResolved.current.set(nextTrack.id, url);
            });
          }
        } catch {
          setIsPlaying(false);
          onNotice?.("Playback could not start. Please try again.");
          await advance();
        }
      };

      await start(track, 0);
    },
    [
      engine,
      loadTrackLyrics,
      onNotice,
      onPlaybackStarted,
      queue,
      resolvePlaybackUrl,
    ],
  );

  const toggle = useCallback(async () => {
    if (!currentTrack) return;
    if (!loadedTrackId.current) {
      await playTrack(currentTrack);
      return;
    }
    if (engine.paused) {
      try {
        await engine.play();
        setIsPlaying(true);
      } catch {
        onNotice?.("Playback could not start. Please try again.");
      }
    } else {
      engine.pause();
      setIsPlaying(false);
    }
  }, [currentTrack, engine, onNotice, playTrack]);

  const next = useCallback(async () => {
    if (queue.length === 0) return;
    if (currentIndex >= queue.length - 1) {
      engine.pause();
      setIsPlaying(false);
      return;
    }
    const track = queue[currentIndex + 1];
    if (track) await playTrack(track);
  }, [currentIndex, engine, playTrack, queue]);

  const previous = useCallback(async () => {
    if (queue.length === 0) return;
    const index = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    const track = queue[index];
    if (track) await playTrack(track);
  }, [currentIndex, playTrack, queue]);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  const restart = useCallback(() => {
    engine.restart();
    setCurrentTime(0);
  }, [engine]);

  const seek = useCallback(
    (seconds: number) => {
      engine.seek(seconds);
      setCurrentTime(seconds);
    },
    [engine],
  );

  const setVolume = useCallback(
    (volume: number) => {
      engine.setVolume(volume);
      setMuted(volume === 0);
    },
    [engine],
  );

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    engine.setVolume(nextMuted ? 0 : 1);
    setMuted(nextMuted);
  }, [engine, muted]);

  const selectTrack = useCallback(
    (trackId: string) => {
      const index = queue.findIndex((track) => track.id === trackId);
      if (index >= 0) setCurrentIndex(index);
    },
    [queue],
  );

  const activeLyricIndex = useMemo(
    () =>
      getActiveLyricIndex(
        lyrics?.lines ?? [],
        currentTime * 1_000,
        lyrics?.offsetMs ?? 0,
      ),
    [currentTime, lyrics],
  );

  return {
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    progress: duration > 0 ? currentTime / duration : 0,
    lyrics: lyrics?.lines ?? null,
    lyricTranslations: lyrics?.translations ?? null,
    activeLyricIndex,
    hasLyrics: Boolean(lyrics?.hasLyrics && lyrics.lines.length > 0),
    lyricsOpen,
    muted,
    playTrack,
    toggle,
    next,
    previous,
    restart,
    seek,
    setVolume,
    toggleMute,
    selectTrack,
    toggleLyrics: () => setLyricsOpen((open) => !open),
  };
}
