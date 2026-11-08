/**
 * Draws the ODEE end card onto the stage canvas so it is part of recordings and
 * screenshots (DOM overlays are never captured by canvas.captureStream()).
 *
 * The DOM card stays in the page as the single source of layout and as the clickable
 * layer (links, tap-to-close) but is made invisible; every text, image and line is
 * painted here at exactly the position the DOM laid it out.
 */
export class EndCardRenderer {
  constructor(
    private readonly card: HTMLElement,
    private readonly app: HTMLElement
  ) {
    this.card.classList.add('canvas-drawn');
  }

  public draw(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
    const origin = this.app.getBoundingClientRect();
    const rel = (el: Element): { x: number; y: number; w: number; h: number } => {
      const r = el.getBoundingClientRect();
      return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
    };

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'source-over';

    // Soft scrim so the text stays readable while camera and fireworks show through.
    const scrim = ctx.createLinearGradient(0, 0, 0, h);
    scrim.addColorStop(0, 'rgba(10, 8, 24, 0.62)');
    scrim.addColorStop(0.38, 'rgba(10, 8, 24, 0.38)');
    scrim.addColorStop(0.62, 'rgba(10, 8, 24, 0.05)');
    scrim.addColorStop(1, 'rgba(10, 8, 24, 0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    // Gold double frame.
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#b8864b';
    ctx.strokeRect(w * 0.027, h * 0.027, w * (1 - 0.054), h * (1 - 0.054));
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.strokeRect(w * 0.034, h * 0.034, w * (1 - 0.068), h * (1 - 0.068));

    // Diyas.
    this.card.querySelectorAll<HTMLImageElement>('.end-diya').forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        const r = rel(img);
        ctx.drawImage(img, r.x, r.y, r.w, r.h);
      }
    });

    // Logo on a white tile.
    const tile = this.card.querySelector('.end-logo-link');
    const logo = this.card.querySelector<HTMLImageElement>('.end-logo');
    if (tile) {
      const t = rel(tile);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(t.x, t.y, t.w, t.h);
    }
    if (logo && logo.complete && logo.naturalWidth > 0) {
      const l = rel(logo);
      ctx.drawImage(logo, l.x, l.y, l.w, l.h);
    }

    // Divider.
    const divider = this.card.querySelector('.end-divider');
    if (divider) {
      const d = rel(divider);
      ctx.fillStyle = '#b8864b';
      ctx.fillRect(d.x, d.y, d.w, Math.max(1, d.h));
    }

    // Text lines, painted from the DOM's own computed fonts and positions.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.card
      .querySelectorAll('.end-title, .end-kannada, .end-links a, .end-sep')
      .forEach((el) => {
        const text = el.textContent?.trim();
        if (!text) return;
        const cs = getComputedStyle(el);
        const r = rel(el);
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        ctx.fillStyle = cs.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * (el.classList.contains('end-sep') ? 0.7 : 1);
        ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
      });

    ctx.restore();
  }
}
