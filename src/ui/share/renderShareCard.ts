/**
 * Offscreen-canvas renderers for share PNGs: the memo is REDRAWN natively at
 * 1080x1350 (4:5) — never a DOM screenshot. Visual constants mirror the
 * CSS deal-memo aesthetic (palette from CLAUDE.md); no gameplay values here.
 */

const W = 1080;
const H = 1350;

const PAPER = '#F7F5EE';
const PAPER_BRIGHT = '#FDFCF7';
const INK = '#1C1B17';
const GREEN = '#1E6B4E';
const RED = '#B3382C';
const YELLOW = '#F5D547';

const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = '"SF Mono", Menlo, Consolas, monospace';

const CARD = { x: 60, y: 60, w: W - 120, h: H - 120, shadow: 16, pad: 64 } as const;

export interface ScorecardShareArgs {
  firmName: string;
  fundIndex: number;
  thesisLine: string;
  dpiLabel: string; // e.g. "0.62x"
  dpiGood: boolean;
  verdictStamp: string; // e.g. "UNDERWATER"
  verdictLine: string;
  fundLabel: string; // e.g. "$9.0M"
  returnedLabel: string;
  checksLabel: string;
  unicornsLabel: string;
}

export interface CareerShareArgs {
  returnedLabel: string; // headline flex
  aumLabel: string;
  fundsLabel: string;
  bestDpiLabel: string;
  unicornsLabel: string;
  enlightened: boolean;
  /** The career ended in legal fees: an obituary instead of a brag. */
  obituary?: { rule: string; stamp: string; line: string };
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return { canvas, ctx };
}

function drawPaperAndCard(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // Offset block shadow, then the card, then the hard border.
  ctx.fillStyle = INK;
  ctx.fillRect(CARD.x + CARD.shadow, CARD.y + CARD.shadow, CARD.w, CARD.h);
  ctx.fillStyle = PAPER_BRIGHT;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.strokeRect(CARD.x, CARD.y, CARD.w, CARD.h);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width <= maxWidth || line === '') {
      line = attempt;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    const last = lines[maxLines - 1] as string;
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function drawHeaderRule(ctx: CanvasRenderingContext2D, label: string): number {
  const x = CARD.x + CARD.pad;
  const y = CARD.y + CARD.pad + 10;
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${MONO}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillRect(x, y + 22, CARD.w - CARD.pad * 2, 5);
  return y + 22 + 5;
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  cx: number,
  cy: number,
  angleRad: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.font = `700 52px ${MONO}`;
  const w = ctx.measureText(text).width + 64;
  const h = 96;
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 4);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawFigures(
  ctx: CanvasRenderingContext2D,
  y: number,
  figures: Array<{ label: string; value: string }>,
): void {
  const x0 = CARD.x + CARD.pad;
  const width = CARD.w - CARD.pad * 2;
  const colW = width / figures.length;
  ctx.fillStyle = INK;
  ctx.fillRect(x0, y, width, 3);
  figures.forEach((fig, i) => {
    const x = x0 + colW * i;
    if (i > 0) ctx.fillRect(x, y + 14, 2, 92);
    const pad = i > 0 ? 24 : 0;
    ctx.font = `24px ${MONO}`;
    ctx.fillText(fig.label.toUpperCase(), x + pad, y + 52);
    ctx.font = `700 44px ${MONO}`;
    ctx.fillText(fig.value, x + pad, y + 104);
  });
}

function drawFooter(ctx: CanvasRenderingContext2D): void {
  const y = CARD.y + CARD.h - CARD.pad + 8;
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${MONO}`;
  ctx.fillText('TERM SHEET HAPPENS', CARD.x + CARD.pad, y);
  ctx.font = `26px ${MONO}`;
  const url = 'termsheethappens.game';
  const w = ctx.measureText(url).width;
  ctx.globalAlpha = 0.7;
  ctx.fillText(url, CARD.x + CARD.w - CARD.pad - w, y);
  ctx.globalAlpha = 1;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

export async function renderScorecardPng(args: ScorecardShareArgs): Promise<Blob> {
  const { canvas, ctx } = makeCanvas();
  drawPaperAndCard(ctx);
  drawHeaderRule(ctx, `Internal memorandum — Fund ${args.fundIndex} final`);

  const x = CARD.x + CARD.pad;
  const textW = CARD.w - CARD.pad * 2;
  let y = CARD.y + CARD.pad + 118;

  ctx.fillStyle = GREEN;
  ctx.font = `700 34px ${MONO}`;
  ctx.fillText(args.firmName.toUpperCase(), x, y);
  y += 64;

  ctx.fillStyle = INK;
  ctx.font = `italic 40px ${SERIF}`;
  for (const line of wrapText(ctx, `“${args.thesisLine}”`, textW, 2)) {
    ctx.fillText(line, x, y);
    y += 52;
  }

  // The big number.
  y += 60;
  ctx.font = `24px ${MONO}`;
  ctx.fillText('DPI', x, y);
  ctx.fillStyle = args.dpiGood ? GREEN : RED;
  ctx.font = `700 200px ${MONO}`;
  ctx.fillText(args.dpiLabel, x - 8, y + 190);
  // Stamp kisses the number's tail like a real over-stamped memo — it must
  // graze, not bury, the digits.
  drawStamp(ctx, args.verdictStamp, args.dpiGood ? GREEN : RED, CARD.x + CARD.w - 220, y + 40, -0.12);
  y += 280;

  ctx.fillStyle = INK;
  ctx.font = `italic 38px ${SERIF}`;
  for (const line of wrapText(ctx, `“${args.verdictLine}”`, textW, 3)) {
    ctx.fillText(line, x, y);
    y += 50;
  }

  drawFigures(ctx, Math.max(y + 26, 1010), [
    { label: 'Fund', value: args.fundLabel },
    { label: 'Returned', value: args.returnedLabel },
    { label: 'Checks', value: args.checksLabel },
    { label: 'Unicorns', value: args.unicornsLabel },
  ]);
  drawFooter(ctx);
  return toBlob(canvas);
}

export async function renderCareerPng(args: CareerShareArgs): Promise<Blob> {
  const { canvas, ctx } = makeCanvas();
  drawPaperAndCard(ctx);
  drawHeaderRule(ctx, args.obituary?.rule ?? 'Career ledger — confidential');

  const x = CARD.x + CARD.pad;
  const textW = CARD.w - CARD.pad * 2;
  let y = CARD.y + CARD.pad + 150;

  ctx.fillStyle = INK;
  ctx.font = `24px ${MONO}`;
  ctx.fillText('RETURNED TO LPS', x, y);
  ctx.fillStyle = args.obituary ? RED : GREEN;
  ctx.font = `700 190px ${MONO}`;
  const returned = wrapText(ctx, args.returnedLabel, textW, 1);
  ctx.fillText(returned[0] ?? args.returnedLabel, x - 6, y + 180);
  y += 300;

  ctx.fillStyle = INK;
  ctx.font = `italic 42px ${SERIF}`;
  if (args.obituary) {
    ctx.fillText(args.obituary.line, x, y);
    // A red rubber stamp, slightly askew.
    ctx.save();
    ctx.font = `700 52px ${MONO}`;
    const tag = args.obituary.stamp;
    const w = ctx.measureText(tag).width + 56;
    ctx.translate(x + 8, y + 70);
    ctx.rotate(-0.05);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, w, 96);
    ctx.fillStyle = RED;
    ctx.fillText(tag, 28, 66);
    ctx.restore();
  } else {
    ctx.fillText('Past performance is no guarantee.', x, y);
    y += 56;
    ctx.fillText('Neither is this.', x, y);
  }

  if (args.enlightened) {
    ctx.save();
    const tag = 'ENLIGHTENED';
    ctx.font = `700 44px ${MONO}`;
    const w = ctx.measureText(tag).width + 56;
    const tx = x;
    const ty = y + 70;
    ctx.fillStyle = INK;
    ctx.fillRect(tx + 8, ty + 8, w, 88);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(tx, ty, w, 88);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.strokeRect(tx, ty, w, 88);
    ctx.fillStyle = INK;
    ctx.fillText(tag, tx + 28, ty + 60);
    ctx.restore();
  }

  drawFigures(ctx, 1010, [
    { label: 'Career AUM', value: args.aumLabel },
    { label: 'Funds', value: args.fundsLabel },
    { label: 'Best DPI', value: args.bestDpiLabel },
    { label: 'Unicorns', value: args.unicornsLabel },
  ]);
  drawFooter(ctx);
  return toBlob(canvas);
}
