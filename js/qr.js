import QRCode from 'qrcode';

const CODE_PATTERN = /^[A-Z0-9]{6}$/;

export async function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, {
    width: 320,
    margin: 1,
    color: { dark: '#0f1115', light: '#ffffff' },
  });
}

export function parseRoomCodeFromText(text) {
  if (!text) return null;

  try {
    const url = new URL(text);
    const code = (url.searchParams.get('code') || '').toUpperCase();
    if (CODE_PATTERN.test(code)) return code;
  } catch {
    // not a URL, fall through
  }

  const trimmed = text.trim().toUpperCase();
  if (CODE_PATTERN.test(trimmed)) return trimmed;

  return null;
}

// Lazy import qr-scanner to avoid pulling its Worker/camera globals into
// the jsdom test environment. Only loaded when createScanner is called
// from a real browser context.
export async function createScanner(videoEl, onCodeFound) {
  const { default: QrScanner } = await import('qr-scanner');
  const scanner = new QrScanner(
    videoEl,
    (result) => {
      const code = parseRoomCodeFromText(result.data || result);
      if (code) onCodeFound(code);
    },
    { highlightScanRegion: true, highlightCodeOutline: true }
  );
  return {
    start: () => scanner.start(),
    stop: () => scanner.stop(),
    destroy: () => scanner.destroy(),
  };
}
