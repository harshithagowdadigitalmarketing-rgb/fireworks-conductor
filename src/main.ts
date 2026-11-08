import './style.css';
import { VideoCompositor } from './video/videoCompositor';
import { VisionEngine } from './vision/visionEngine';
import { FireworkDirector } from './fireworks/fireworkDirector';
import { PyroAudioEngine } from './audio/pyroAudioEngine';
import { CaptureEngine } from './capture/captureEngine';
import { WritingEngine } from './writing/writingEngine';

class FireworksApp {
  private compositor: VideoCompositor;
  private vision: VisionEngine;
  private director: FireworkDirector;
  private audio: PyroAudioEngine;
  private capture: CaptureEngine;
  private writing: WritingEngine = new WritingEngine();

  // DOM Elements
  private hudElement: HTMLElement;
  private restoreHudBtn: HTMLElement;
  private audioBtn: HTMLElement;
  private recordBtn: HTMLElement;
  private recordLabel: HTMLElement;
  private recordTimer: HTMLElement;
  private finaleCenter: HTMLElement;
  private endCardTimer: number = 0;
  private endCardForHold: number = -1;
  private lastCelebration: number = 0;
  private static readonly NAMASTE_CARD_MS = 3000;

  // Fog-Mirror Style Reel Preview Elements
  private reelPreviewCard: HTMLElement;
  private reelPreviewVideo: HTMLVideoElement;
  private reelPreviewThumbBtn: HTMLElement;
  private reelDuration: HTMLElement;
  private reelViewBtn: HTMLElement;
  private reelSaveBtn: HTMLElement;
  private reelDismissBtn: HTMLElement;

  // Full Reel Dialog Elements
  private reelDialog: HTMLDialogElement;
  private reelDialogVideo: HTMLVideoElement;
  private reelDialogSaveBtn: HTMLElement;
  private reelDialogCloseBtn: HTMLElement;

  private isCreatorMode: boolean = false;
  private lastFrameTime: number = performance.now();
  private recordedVideoUrl: string = '';

  constructor() {
    const canvas = document.getElementById('stage') as HTMLCanvasElement;
    const video = document.getElementById('webcam') as HTMLVideoElement;
    this.hudElement = document.getElementById('hud') as HTMLElement;
    this.restoreHudBtn = document.getElementById('btn-restore-hud') as HTMLElement;
    this.audioBtn = document.getElementById('btn-audio') as HTMLElement;
    this.recordBtn = document.getElementById('btn-record') as HTMLElement;
    this.recordLabel = document.getElementById('record-label') as HTMLElement;
    this.recordTimer = document.getElementById('record-timer') as HTMLElement;
    this.finaleCenter = document.getElementById('grand-finale-center') as HTMLElement;

    // Fog-Mirror Floating Preview Card Elements
    this.reelPreviewCard = document.getElementById('reel-preview-card') as HTMLElement;
    this.reelPreviewVideo = document.getElementById('reel-preview-video') as HTMLVideoElement;
    this.reelPreviewThumbBtn = document.getElementById('reel-preview-thumb-btn') as HTMLElement;
    this.reelDuration = document.getElementById('reel-duration') as HTMLElement;
    this.reelViewBtn = document.getElementById('reel-view-btn') as HTMLElement;
    this.reelSaveBtn = document.getElementById('reel-save-btn') as HTMLElement;
    this.reelDismissBtn = document.getElementById('reel-dismiss-btn') as HTMLElement;

    // Fog-Mirror Dialog Elements
    this.reelDialog = document.getElementById('reel-dialog') as HTMLDialogElement;
    this.reelDialogVideo = document.getElementById('reel-dialog-video') as HTMLVideoElement;
    this.reelDialogSaveBtn = document.getElementById('reel-dialog-save-btn') as HTMLElement;
    this.reelDialogCloseBtn = document.getElementById('reel-dialog-close-btn') as HTMLElement;

    // Subsystems
    this.compositor = new VideoCompositor({ canvas, video });
    this.vision = new VisionEngine();
    this.audio = new PyroAudioEngine();
    this.director = new FireworkDirector();
    this.capture = new CaptureEngine(canvas);

    // Audio Trigger Callback
    this.director.setSoundCallback((soundType, intensity) => {
      switch (soundType) {
        case 'ROCKET_LAUNCH':
          this.audio.playRocketLaunch();
          break;
        case 'EXPLOSION':
          this.audio.playExplosion(intensity);
          break;
        case 'ANAR_LOOP':
          this.audio.pulseAnarLoop();
          break;
        case 'SPARKLER_LOOP':
          this.audio.pulseSparklerLoop();
          break;
        case 'ROMAN_POP':
          this.audio.playRomanPop();
          break;
        case 'FINALE':
          this.audio.playFinaleBarrage();
          break;
      }
    });

    this.setupListeners();
    this.init();
  }

  private setupListeners(): void {
    const unlockAudio = () => this.audio.unlock();
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // 1. Creator Mode Toggle (H key)
    const cornerLeft = document.getElementById('corner-left');
    const toggleCreatorMode = () => {
      this.isCreatorMode = !this.isCreatorMode;
      if (this.isCreatorMode) {
        this.hudElement.classList.add('hud-hidden');
        this.restoreHudBtn.classList.remove('hidden');
        if (cornerLeft) cornerLeft.style.opacity = '0';
      } else {
        this.hudElement.classList.remove('hud-hidden');
        this.restoreHudBtn.classList.add('hidden');
        if (cornerLeft) cornerLeft.style.opacity = '1';
      }
    };
    this.restoreHudBtn.addEventListener('click', toggleCreatorMode);

    // End card: click anywhere (except its links) to close
    this.finaleCenter.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('a')) this.finaleCenter.classList.add('hidden');
    });

    // 2. Debug Tracker Skeleton (D key)
    const toggleDebug = () => {
      this.vision.showDebug = !this.vision.showDebug;
    };

    // 3. Audio Toggle (M key)
    const toggleAudio = () => {
      this.audio.unlock();
      const muted = this.audio.toggleMute();
      const label = this.audioBtn.querySelector('.btn-label');
      const icon = this.audioBtn.querySelector('.btn-icon');
      if (label && icon) {
        label.textContent = muted ? 'Muted' : 'Sound';
        icon.textContent = muted ? '🔇' : '🔊';
      }
      if (muted) {
        this.audioBtn.classList.add('btn-active');
      } else {
        this.audioBtn.classList.remove('btn-active');
      }
    };
    this.audioBtn.addEventListener('click', toggleAudio);

    // 3b. Air-writing mode (W key): write with finger / pencil, mouse as fallback
    const writeBtn = document.getElementById('btn-write') as HTMLElement;
    const writeTools = document.getElementById('write-tools') as HTMLElement;
    const inkDots = Array.from(document.querySelectorAll<HTMLElement>('.ink-dot'));
    const syncInk = () => inkDots.forEach((d) => d.classList.toggle('active', Number(d.dataset.ink) === this.writing.colorIndex));
    const toggleWrite = () => {
      this.writing.setEnabled(!this.writing.enabled);
      writeBtn.classList.toggle('btn-active', this.writing.enabled);
      writeTools.classList.toggle('hidden', !this.writing.enabled);
      this.compositor.canvas.classList.toggle('writing-cursor', this.writing.enabled);
    };
    writeBtn.addEventListener('click', toggleWrite);
    inkDots.forEach((d) => d.addEventListener('click', () => { this.writing.setColor(Number(d.dataset.ink)); syncInk(); }));
    document.getElementById('btn-write-undo')?.addEventListener('click', () => this.writing.undo());
    document.getElementById('btn-write-clear')?.addEventListener('click', () => this.writing.clear());
    const stage = this.compositor.canvas;
    const toCanvas = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * this.compositor.width, y: ((e.clientY - r.top) / r.height) * this.compositor.height };
    };
    stage.addEventListener('pointerdown', (e) => { const p = toCanvas(e); this.writing.pointerDown(p.x, p.y); });
    stage.addEventListener('pointermove', (e) => { const p = toCanvas(e); this.writing.pointerMove(p.x, p.y); });
    window.addEventListener('pointerup', () => this.writing.pointerUp());

    // 4. Postcard Screenshot (S key)
    const takeSnap = () => {
      this.capture.takeScreenshot();
    };

    // 5. Video Reel Recording (R key)
    const toggleRecording = () => {
      this.audio.unlock();
      if (this.capture.isRecording) {
        this.capture.stopRecording();
      } else {
        const audioTrack = this.audio.getAudioStream();
        this.capture.startRecording(audioTrack);
      }
    };
    this.recordBtn.addEventListener('click', toggleRecording);

    // Configure capture callbacks
    let recordedSeconds = 0;
    this.capture.setCallbacks({
      onRecordingStart: () => {
        this.recordBtn.classList.add('recording');
        this.recordLabel.textContent = 'Stop';
        this.dismissReelPreview();
      },
      onRecordingStop: (_blob, videoUrl) => {
        this.recordBtn.classList.remove('recording');
        this.recordLabel.textContent = 'Record';
        this.recordTimer.textContent = '00:00';

        // Present Fog-Mirror Style Floating Preview Card
        this.showReelPreview(videoUrl, recordedSeconds);
      },
      onTimeUpdate: (elapsed, max) => {
        recordedSeconds = elapsed;
        const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
        const maxS = Math.floor(max % 60).toString().padStart(2, '0');
        this.recordTimer.textContent = `${m}:${s} / 00:${maxS}`;
      }
    });

    // Fog-Mirror Floating Preview Card Handlers
    this.reelSaveBtn.addEventListener('click', () => {
      this.capture.downloadCurrentReel();
    });

    this.reelDismissBtn.addEventListener('click', () => {
      this.dismissReelPreview();
    });

    const openFullDialog = () => {
      if (!this.recordedVideoUrl) return;
      this.reelDialogVideo.src = this.recordedVideoUrl;
      this.reelDialog.showModal();
      this.reelDialogVideo.currentTime = 0;
      this.reelDialogVideo.play().catch(() => {});
    };

    this.reelViewBtn.addEventListener('click', openFullDialog);
    this.reelPreviewThumbBtn.addEventListener('click', openFullDialog);

    // Full Reel Dialog Handlers
    const closeFullDialog = () => {
      this.reelDialog.close();
      this.reelDialogVideo.pause();
    };

    this.reelDialogCloseBtn.addEventListener('click', closeFullDialog);
    this.reelDialogSaveBtn.addEventListener('click', () => {
      this.capture.downloadCurrentReel();
    });

    // Global Keybindings
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.finaleCenter.classList.add('hidden');
        if (this.reelDialog.open) closeFullDialog();
        else this.dismissReelPreview();
      }
      if (e.key === 'h' || e.key === 'H') toggleCreatorMode();
      if (e.key === 'd' || e.key === 'D') toggleDebug();
      if (e.key === 'm' || e.key === 'M') toggleAudio();
      if (e.key === 's' || e.key === 'S') takeSnap();
      if (e.key === 'r' || e.key === 'R') toggleRecording();
      if (e.key === 'w' || e.key === 'W') toggleWrite();
      if (this.writing.enabled) {
        if (e.key === 'x' || e.key === 'X') this.writing.clear();
        if (e.key === 'z' || e.key === 'Z') this.writing.undo();
        if (e.key === 'c' || e.key === 'C') { this.writing.cycleColor(); syncInk(); }
      }

      // Manual Testing Keys (1 to 6)
      const w = this.compositor.width;
      const h = this.compositor.height;
      const center = { x: w / 2, y: h / 2 };

      if (e.key === '1') {
        this.director.handleGestures([{ type: 'ROCKET', confidence: 1, triggerPoint: { x: w * 0.5, y: h * 0.8 }, handIndex: 0, isContinuous: false }], w, h);
      } else if (e.key === '2') {
        this.director.handleGestures([{ type: 'ANAR', confidence: 1, triggerPoint: { x: w * 0.5, y: h * 0.75 }, handIndex: 0, isContinuous: true }], w, h);
      } else if (e.key === '3') {
        this.director.handleGestures([{ type: 'STARBURST', confidence: 1, triggerPoint: center, handIndex: 0, isContinuous: false }], w, h);
      } else if (e.key === '4') {
        this.director.handleGestures([{ type: 'ROMAN_CANDLE', confidence: 1, triggerPoint: { x: w * 0.5, y: h * 0.7 }, handIndex: 0, isContinuous: false }], w, h);
      } else if (e.key === '5') {
        this.director.handleGestures([{ type: 'PHOOLJHADI', confidence: 1, triggerPoint: center, handIndex: 0, isContinuous: true }], w, h);
      } else if (e.key === '6') {
        this.triggerGrandFinale(w, h);
        // Keyboard test path: mimic holding Namaste for 3 seconds
        window.clearTimeout(this.endCardTimer);
        this.endCardTimer = window.setTimeout(() => this.showEndCard(), FireworksApp.NAMASTE_CARD_MS);
      }
    });

    // NOTE: Mouse click rocket trigger intentionally removed per user request.
    // Fireworks are now triggered exclusively through webcam hand gestures or hotkeys.
  }

  private showReelPreview(videoUrl: string, seconds: number): void {
    this.recordedVideoUrl = videoUrl;
    this.reelPreviewVideo.src = videoUrl;
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    this.reelDuration.textContent = `${m}:${s}`;
    this.reelPreviewCard.classList.remove('hidden');
    this.reelPreviewVideo.play().catch(() => {});
  }

  private dismissReelPreview(): void {
    this.reelPreviewCard.classList.add('hidden');
    this.reelPreviewVideo.pause();
    this.reelPreviewVideo.src = '';
  }

  private triggerGrandFinale(w: number, h: number): void {
    this.director.handleGestures(
      [{ type: 'GRAND_FINALE', confidence: 1, triggerPoint: { x: w / 2, y: h / 2 }, handIndex: -1, isContinuous: false }],
      w,
      h
    );
  }

  /** Shows the ODEE end card and hides it again after 15s (long enough to click the links). */
  private showEndCard(): void {
    if (this.finaleCenter.classList.contains('hidden')) {
      // Fresh grand barrage as the card appears; steady celebration continues while it is up
      this.triggerGrandFinale(this.compositor.width, this.compositor.height);
      this.lastCelebration = performance.now();
    }
    this.finaleCenter.classList.remove('hidden');
    window.clearTimeout(this.endCardTimer);
    this.endCardTimer = window.setTimeout(() => {
      this.finaleCenter.classList.add('hidden');
    }, 15000);
  }

  private async init(): Promise<void> {
    try {
      await this.compositor.startCamera();
      await this.vision.init();
    } catch (err) {
      console.error('Initialization failed:', err);
    }
    this.loop();
  }

  private loop = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    // 1. Draw atmospheric night camera background
    this.compositor.drawBackground();

    // 2. Process vision frame
    const activeGestures = this.vision.update(
      this.compositor.video,
      this.compositor.width,
      this.compositor.height
    );

    // End card: show it once Namaste has been held for 3 seconds (once per hold)
    const namasteSince = this.vision.namasteSince;
    if (
      !this.writing.enabled &&
      namasteSince > 0 &&
      namasteSince !== this.endCardForHold &&
      now - namasteSince >= FireworksApp.NAMASTE_CARD_MS
    ) {
      this.endCardForHold = namasteSince;
      this.showEndCard();
    }

    // Feed hands to the air-writing engine (finger / pencil)
    this.writing.update(this.vision.detectedHands, this.compositor.video, this.compositor.width, this.compositor.height, now);

    // Check if Grand Finale was recognized by gesture (suppressed while writing)
    const isFinale = !this.writing.enabled && activeGestures.some((g) => g.type === 'GRAND_FINALE');
    if (isFinale) {
      this.triggerGrandFinale(this.compositor.width, this.compositor.height);
    } else {
      // 3. Dispatch other active gestures to Firework Director (none while writing)
      this.director.handleGestures(
        this.writing.enabled ? [] : activeGestures,
        this.compositor.width,
        this.compositor.height
      );
    }

    // 3b. While the end card is up, keep the sky celebrating (rockets + starbursts)
    if (!this.finaleCenter.classList.contains('hidden') && now - this.lastCelebration > 550) {
      this.lastCelebration = now;
      const cw = this.compositor.width;
      const ch = this.compositor.height;
      const burst = Math.random() < 0.5;
      this.director.handleGestures(
        [
          burst
            ? { type: 'STARBURST', confidence: 1, triggerPoint: { x: cw * (0.1 + Math.random() * 0.8), y: ch * (0.25 + Math.random() * 0.35) }, handIndex: 5, isContinuous: false }
            : { type: 'ROCKET', confidence: 1, triggerPoint: { x: cw * (0.1 + Math.random() * 0.8), y: ch * 0.85 }, handIndex: 5, isContinuous: false }
        ],
        cw,
        ch
      );
    }

    // 4. Simulate & Render Particle Fireworks with Additive Blending & Lighting
    this.director.updateAndRender(dt, this.compositor.ctx);

    // 4b. Draw written ink on top of fireworks (included in screenshots & recordings)
    this.writing.render(this.compositor.ctx);

    // 5. Draw Debug skeleton if active
    this.vision.drawDebugSkeleton(this.compositor.ctx);

    requestAnimationFrame(this.loop);
  };
}

window.addEventListener('DOMContentLoaded', () => {
  new FireworksApp();
});
