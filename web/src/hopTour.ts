interface Playback { readonly playing: boolean; setPlaying(value: boolean): void }
interface FollowCamera { start(): void; stop(): void; isFollowing(): boolean }

/** A ride owns playback temporarily; stopping restores the user's prior setting. */
export class StreetcarTour {
  active = false;
  label = '';
  private wasPlaying = false;
  private playback: Playback;
  private camera: FollowCamera;
  constructor(playback: Playback, camera: FollowCamera) { this.playback = playback; this.camera = camera; }
  get paused() { return this.active && !this.playback.playing; }
  start(label: string) {
    if (!this.active) this.wasPlaying = this.playback.playing;
    this.label = label; this.active = true;
    this.playback.setPlaying(true); this.camera.start();
  }
  togglePause() { if (this.active) this.playback.setPlaying(!this.playback.playing); }
  stop() {
    if (!this.active) return;
    this.active = false;
    if (this.camera.isFollowing()) this.camera.stop();
    this.playback.setPlaying(this.wasPlaying);
  }
  update() { if (this.active && !this.camera.isFollowing()) this.stop(); }
}
