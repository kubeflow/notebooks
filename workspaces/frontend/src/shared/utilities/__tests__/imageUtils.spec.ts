import {
  isAbsoluteUrl,
  detectImageMimeType,
  fetchImageAsBlob,
} from '~/shared/utilities/imageUtils';

describe('isAbsoluteUrl', () => {
  it('returns true for https URLs', () => {
    expect(isAbsoluteUrl('https://example.com/image.png')).toBe(true);
  });

  it('returns true for http URLs', () => {
    expect(isAbsoluteUrl('http://example.com/image.png')).toBe(true);
  });

  it('returns true for data URLs', () => {
    expect(isAbsoluteUrl('data:image/png;base64,abc')).toBe(true);
  });

  it('returns false for relative paths', () => {
    expect(isAbsoluteUrl('/api/v1/workspacekinds/jupyter/assets/icon')).toBe(false);
  });

  it('returns false for bare filenames', () => {
    expect(isAbsoluteUrl('icon.png')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAbsoluteUrl('')).toBe(false);
  });
});

describe('detectImageMimeType', () => {
  it('detects SVG', () => {
    expect(detectImageMimeType('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(
      'image/svg+xml',
    );
  });

  it('detects SVG with leading whitespace', () => {
    expect(detectImageMimeType('  \n<svg></svg>')).toBe('image/svg+xml');
  });

  it('detects PNG', () => {
    expect(detectImageMimeType('\x89PNG\r\n')).toBe('image/png');
  });

  it('detects JPEG', () => {
    expect(detectImageMimeType('\xFF\xD8\xFF\xE0')).toBe('image/jpeg');
  });

  it('detects GIF87a', () => {
    expect(detectImageMimeType('GIF87a...')).toBe('image/gif');
  });

  it('detects GIF89a', () => {
    expect(detectImageMimeType('GIF89a...')).toBe('image/gif');
  });

  it('detects WebP', () => {
    expect(detectImageMimeType('RIFF\x00\x00\x00\x00WEBP')).toBe('image/webp');
  });

  it('returns empty string for unknown formats', () => {
    expect(detectImageMimeType('unknown binary data')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(detectImageMimeType('')).toBe('');
  });
});

describe('fetchImageAsBlob', () => {
  const mockBlob = new Blob(['test'], { type: 'image/png' });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches the URL and returns a blob', async () => {
    const result = await fetchImageAsBlob('https://example.com/image.png');
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.png');
    expect(result).toBe(mockBlob);
  });

  it('propagates fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    await expect(fetchImageAsBlob('https://example.com/bad')).rejects.toThrow('Network error');
  });
});
