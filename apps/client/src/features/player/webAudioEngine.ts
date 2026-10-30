import type { AudioEngine } from "./AudioEngine";

export class WebAudioEngine implements AudioEngine {
  private readonly audio: HTMLAudioElement;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onPlayStateChange?: (paused: boolean) => void;
  onError?: (message: string) => void;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () => {
      this.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
    });
    this.audio.addEventListener("ended", () => this.onEnded?.());
    this.audio.addEventListener("play", () => this.onPlayStateChange?.(false));
    this.audio.addEventListener("pause", () => this.onPlayStateChange?.(true));
    this.audio.addEventListener("error", () =>
      this.onError?.("Playback failed."),
    );
  }

  get currentTime() {
    return this.audio.currentTime;
  }

  get duration() {
    return this.audio.duration || 0;
  }

  get paused() {
    return this.audio.paused;
  }

  get volume() {
    return this.audio.volume;
  }

  load(url: string) {
    this.audio.src = url;
    this.audio.load();
  }

  play() {
    return this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  seek(seconds: number) {
    this.audio.currentTime = Math.max(
      0,
      Math.min(seconds, this.audio.duration || seconds),
    );
  }

  restart() {
    this.audio.currentTime = 0;
  }

  setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  dispose() {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
