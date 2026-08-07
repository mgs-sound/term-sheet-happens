/**
 * ShareService — scorecard sharing behind an interface so Capacitor Share can
 * replace the Web Share API later without touching game or UI code.
 *
 * Web fallback chain: navigator.share with files -> navigator.share text ->
 * clipboard (PNG + text when supported, else text + PNG download) -> PNG
 * download alone. The caller renders the PNG (offscreen canvas) and hands
 * the blob here; this service is transport only.
 */

export type ShareOutcome =
  | 'shared' // native share sheet completed
  | 'copied' // landed on the clipboard
  | 'downloaded' // PNG downloaded (text copied when possible)
  | 'cancelled' // user dismissed the share sheet
  | 'unavailable'; // no mechanism worked

export interface SharePayload {
  title: string;
  /** Headline flex, e.g. "I've returned $312M to LPs." */
  text: string;
  /** Canvas-rendered PNG of the memo, when available. */
  image?: { blob: Blob; filename: string };
}

export interface ShareService {
  share(payload: SharePayload): Promise<ShareOutcome>;
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export class WebShareService implements ShareService {
  async share(payload: SharePayload): Promise<ShareOutcome> {
    const file = payload.image
      ? new File([payload.image.blob], payload.image.filename, { type: 'image/png' })
      : null;

    if (
      file &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: payload.title, text: payload.text });
        return 'shared';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
        // Fall through to text share.
      }
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: payload.title, text: payload.text });
        return 'shared';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
        // Fall through to clipboard.
      }
    }

    if (payload.image && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': payload.image.blob,
            'text/plain': new Blob([payload.text], { type: 'text/plain' }),
          }),
        ]);
        return 'copied';
      } catch {
        // Some browsers reject multi-type items; keep falling.
      }
    }

    let textCopied = false;
    try {
      await navigator.clipboard.writeText(payload.text);
      textCopied = true;
    } catch {
      // Clipboard may be unavailable entirely.
    }

    if (file) {
      this.download(file);
      return 'downloaded';
    }
    return textCopied ? 'copied' : 'unavailable';
  }

  private download(file: File): void {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
