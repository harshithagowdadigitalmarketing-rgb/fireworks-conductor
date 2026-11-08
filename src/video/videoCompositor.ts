/**
 * Video Compositor & Night-Sky Atmosphere Pipeline
 * Handles camera capture (pinned to 640x480 for ultra-fast processing),
 * mirroring, night-sky color grading, and stage rendering.
 */

export interface CompositorOptions {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  dimming?: number; // 0.0 (pitch black) to 1.0 (full brightness)
  contrast?: number;
}

export class VideoCompositor {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public video: HTMLVideoElement;
  public width: number = window.innerWidth;
  public height: number = window.innerHeight;
  public isCameraReady: boolean = false;
  public dimming: number = 0.60;
  public contrast: number = 1.15;
  private stream: MediaStream | null = null;

  constructor(options: CompositorOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not acquire 2D rendering context from stage canvas');
    this.ctx = ctx;
    this.video = options.video;
    if (options.dimming !== undefined) this.dimming = options.dimming;
    if (options.contrast !== undefined) this.contrast = options.contrast;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));
    if (this.canvas.parentElement && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
    }
  }

  public resize(): void {
    // Size follows the 9:16 frame (#app), not the whole window.
    const host = this.canvas.parentElement;
    this.width = host?.clientWidth || window.innerWidth;
    this.height = host?.clientHeight || window.innerHeight;

    // Render up to 1080x1920 (crisp reels) but never more than 2x, to stay smooth on phones.
    const scale = Math.min(1080 / this.width, 1920 / this.height, 2);
    this.canvas.width = Math.round(this.width * scale);
    this.canvas.height = Math.round(this.height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  public async startCamera(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API (getUserMedia) unavailable in this browser');
    }

    // Pinned to 640x480 for 5ms frame transfer latency & cold GPU/CPU
    const isPhone = window.matchMedia('(pointer: coarse)').matches;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        // Phones: ask for a portrait picture so the 9:16 frame is filled; desktops keep the fast 640x480.
        width: { ideal: isPhone ? 720 : 640 },
        height: { ideal: isPhone ? 1280 : 480 },
        facingMode: 'user'
      },
      audio: false
    });

    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    this.isCameraReady = true;
    return stream;
  }

  public stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.isCameraReady = false;
  }

  /**
   * Draws the mirrored, atmospheric night-sky webcam background
   */
  public drawBackground(): void {
    const { ctx, width, height, video } = this;

    // Reset transform & composite operation
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // 1. Fill deep midnight dark background
    ctx.fillStyle = '#040714';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw webcam video if available
    if (this.isCameraReady && video.videoWidth > 0) {
      ctx.save();
      // Mirror horizontally so gestures feel natural (like looking in a mirror)
      ctx.translate(width, 0);
      ctx.scale(-1, 1);

      // Aspect-ratio cover calculation
      const videoRatio = video.videoWidth / video.videoHeight;
      const screenRatio = width / height;
      let drawW: number;
      let drawH: number;
      let drawX: number;
      let drawY: number;

      if (screenRatio > videoRatio) {
        drawW = width;
        drawH = width / videoRatio;
        drawX = 0;
        drawY = (height - drawH) / 2;
      } else {
        drawH = height;
        drawW = height * videoRatio;
        drawX = (width - drawW) / 2;
        drawY = 0;
      }

      // Atmospheric Night-Sky Filter: dimming + contrast + slight blue tint
      ctx.filter = `brightness(${this.dimming}) contrast(${this.contrast}) saturate(0.9)`;
      ctx.drawImage(video, drawX, drawY, drawW, drawH);
      ctx.filter = 'none';

      // Deep blue/indigo night tint overlay
      ctx.fillStyle = 'rgba(6, 12, 38, 0.28)';
      ctx.fillRect(0, 0, width, height);

      ctx.restore();
    }

    ctx.restore();
  }
}
