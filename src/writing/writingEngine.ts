import { HandPose } from '../vision/gestureTypes';

/**
 * Air-writing engine.
 *
 * Draws glowing ink on top of the camera feed while the user either
 *  - points with the index finger (other fingers curled), or
 *  - pinches thumb + index, the way a pencil / pen is held.
 *
 * Note: the tracker follows the HAND, not the pencil itself. For a pencil we
 * draw at the pinch point pushed slightly forward along the index finger,
 * which approximates the pencil tip.
 */

export interface InkColor {
  name: string;
  core: string;
  glow: string;
}

export const INK_COLORS: InkColor[] = [
  { name: 'Sky', core: '#BFE6F7', glow: '#24A7DF' },
  { name: 'Orange', core: '#FFE0BF', glow: '#FB7D04' },
  { name: 'Green', core: '#C4F5DF', glow: '#11A86F' },
  { name: 'White', core: '#FFFFFF', glow: '#8FB8D8' }
];

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: InkColor;
  width: number;
}

const PEN_UP_GRACE_MS = 140; // tolerate brief tracking dropouts mid-word
const SMOOTHING = 0.45; // 0 = frozen, 1 = raw (higher = more responsive)
const MIN_SEGMENT = 1.5; // px; ignore sub-pixel jitter
const MAX_STROKES = 400;

export class WritingEngine {
  public enabled = false;
  public penDown = false;
  public colorIndex = 0;
  public penWidth = 7;

  private strokes: Stroke[] = [];
  private current: Stroke | null = null;
  private smoothed: Point | null = null;
  private lastSeen = 0;
  private cursor: Point | null = null; // where the pen tip is (shown as a dot even when not drawing)
  private mouseDown = false;

  public get color(): InkColor {
    return INK_COLORS[this.colorIndex % INK_COLORS.length];
  }

  public get hasInk(): boolean {
    return this.strokes.length > 0 || this.current !== null;
  }

  public setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.endStroke();
      this.cursor = null;
      this.smoothed = null;
    }
  }

  public cycleColor(): void {
    this.setColor(this.colorIndex + 1);
  }

  public setColor(index: number): void {
    this.endStroke();
    this.colorIndex = ((index % INK_COLORS.length) + INK_COLORS.length) % INK_COLORS.length;
  }

  public clear(): void {
    this.strokes = [];
    this.current = null;
    this.smoothed = null;
  }

  public undo(): void {
    this.endStroke();
    this.strokes.pop();
  }

  // ---- Mouse / touch fallback (also handy when no camera is available) ----

  public pointerDown(x: number, y: number): void {
    if (!this.enabled) return;
    this.mouseDown = true;
    this.endStroke();
    this.smoothed = null;
    this.addPoint({ x, y });
  }

  public pointerMove(x: number, y: number): void {
    if (!this.enabled) return;
    this.cursor = { x, y };
    if (this.mouseDown) this.addPoint({ x, y });
  }

  public pointerUp(): void {
    this.mouseDown = false;
    this.endStroke();
  }

  // ---- Hand tracking ----

  /**
   * Feed the latest hand poses. Coordinates are mapped from the video frame to the
   * canvas with the same "cover" + mirror transform the compositor uses, so the ink
   * lands exactly under the fingertip.
   */
  public update(
    hands: HandPose[],
    video: HTMLVideoElement,
    width: number,
    height: number,
    now: number
  ): void {
    if (!this.enabled || this.mouseDown) return;

    const tip = this.findPenTip(hands, video, width, height);
    if (tip) {
      this.lastSeen = now;
      this.cursor = tip.point;
      if (tip.writing) {
        this.addPoint(tip.point);
      } else {
        this.endStroke();
      }
    } else if (now - this.lastSeen > PEN_UP_GRACE_MS) {
      this.endStroke();
      this.cursor = null;
    }
  }

  private findPenTip(
    hands: HandPose[],
    video: HTMLVideoElement,
    width: number,
    height: number
  ): { point: Point; writing: boolean } | null {
    if (video.videoWidth === 0 || hands.length === 0) return null;

    const map = (nx: number, ny: number): Point => {
      const vr = video.videoWidth / video.videoHeight;
      const sr = width / height;
      let dw: number;
      let dh: number;
      let dx: number;
      let dy: number;
      if (sr > vr) {
        dw = width;
        dh = width / vr;
        dx = 0;
        dy = (height - dh) / 2;
      } else {
        dh = height;
        dw = height * vr;
        dx = (width - dw) / 2;
        dy = 0;
      }
      return { x: width - (dx + nx * dw), y: dy + ny * dh };
    };

    let best: { point: Point; writing: boolean } | null = null;

    for (const hand of hands) {
      const lm = hand.rawLandmarks;
      const indexTip = map(lm[8].x, lm[8].y);
      const indexMcp = map(lm[5].x, lm[5].y);
      const thumbTip = map(lm[4].x, lm[4].y);

      const f = hand.extendedFingers;
      const pointing = f.index && !f.middle && !f.ring && !f.pinky;

      // Hand-size aware pinch threshold (pencil grip: thumb + index close together).
      const handSize = Math.hypot(indexMcp.x - map(lm[0].x, lm[0].y).x, indexMcp.y - map(lm[0].x, lm[0].y).y);
      const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      const pinching = pinchDist < Math.max(22, handSize * 0.55);

      let point: Point;
      let writing: boolean;

      if (pointing) {
        point = indexTip;
        writing = true;
      } else if (pinching) {
        // Pencil grip: the real tip is just beyond the pinch point, along the index finger.
        const mid = { x: (thumbTip.x + indexTip.x) / 2, y: (thumbTip.y + indexTip.y) / 2 };
        const dirX = indexTip.x - indexMcp.x;
        const dirY = indexTip.y - indexMcp.y;
        point = { x: mid.x + dirX * 0.35, y: mid.y + dirY * 0.35 };
        writing = true;
      } else {
        // Hand visible but not in a writing pose: show the hover dot, lift the pen.
        point = indexTip;
        writing = false;
      }

      if (!best || (writing && !best.writing)) best = { point, writing };
    }

    return best;
  }

  private addPoint(raw: Point): void {
    // Exponential smoothing removes tracker jitter so handwriting looks clean.
    const p = this.smoothed
      ? {
          x: this.smoothed.x + (raw.x - this.smoothed.x) * SMOOTHING,
          y: this.smoothed.y + (raw.y - this.smoothed.y) * SMOOTHING
        }
      : raw;
    this.smoothed = p;

    if (!this.current) {
      this.current = { points: [p], color: this.color, width: this.penWidth };
      this.penDown = true;
      return;
    }
    const last = this.current.points[this.current.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= MIN_SEGMENT) {
      this.current.points.push(p);
    }
  }

  private endStroke(): void {
    if (this.current) {
      this.strokes.push(this.current);
      if (this.strokes.length > MAX_STROKES) this.strokes.shift();
      this.current = null;
    }
    this.smoothed = null;
    this.penDown = false;
  }

  // ---- Rendering ----

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled && !this.hasInk) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const all = this.current ? [...this.strokes, this.current] : this.strokes;
    for (const s of all) this.drawStroke(ctx, s);

    // Pen-tip cursor so the user sees exactly where the ink will go.
    if (this.enabled && this.cursor) {
      const c = this.color;
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = this.penDown ? c.core : 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(this.cursor.x, this.cursor.y, this.penDown ? this.penWidth * 0.9 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = c.glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.cursor.x, this.cursor.y, 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawStroke(ctx: CanvasRenderingContext2D, s: Stroke): void {
    const pts = s.points;
    if (pts.length === 0) return;

    const path = (): void => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) {
        ctx.lineTo(pts[0].x + 0.01, pts[0].y);
        return;
      }
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    };

    // Soft colored glow, then a bright core: readable on any camera background.
    ctx.shadowColor = s.color.glow;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = s.color.glow;
    ctx.lineWidth = s.width + 4;
    path();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = s.color.core;
    ctx.lineWidth = s.width * 0.55;
    path();
    ctx.stroke();
  }
}
