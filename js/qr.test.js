import { describe, it, expect, vi } from 'vitest';
import { generateQrDataUrl, parseRoomCodeFromText } from './qr.js';

describe('parseRoomCodeFromText', () => {
  it('extracts code from a /display?code=ABC123 URL', () => {
    expect(parseRoomCodeFromText('https://x.example/display?code=ABC123')).toBe('ABC123');
  });

  it('returns null for unrelated text', () => {
    expect(parseRoomCodeFromText('hello world')).toBeNull();
  });

  it('upper-cases code from query', () => {
    expect(parseRoomCodeFromText('https://x.example/display?code=abc123')).toBe('ABC123');
  });

  it('returns null for invalid code length', () => {
    expect(parseRoomCodeFromText('https://x.example/display?code=AB')).toBeNull();
  });

  it('extracts a bare 6-char code', () => {
    expect(parseRoomCodeFromText('AB12CD')).toBe('AB12CD');
  });
});

describe('generateQrDataUrl', () => {
  it('returns a data URL string', async () => {
    const url = await generateQrDataUrl('https://example.com/display?code=ABC123');
    expect(url).toMatch(/^data:image\/png/);
  });
});
