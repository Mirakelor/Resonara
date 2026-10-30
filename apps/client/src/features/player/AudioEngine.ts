export interface AudioEngine {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onPlayStateChange?: (paused: boolean) => void;
  onError?: (message: string) => void;
  load(url: string): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  restart(): void;
  setVolume(volume: number): void;
  dispose(): void;
}
