export const isAbsoluteUrl = (url: string): boolean => {
  try {
    return !!new URL(url).protocol;
  } catch {
    return false;
  }
};

export const detectImageMimeType = (data: string): string => {
  if (data.trimStart().startsWith('<svg')) {
    return 'image/svg+xml';
  }
  if (data.startsWith('\x89PNG')) {
    return 'image/png';
  }
  if (data.startsWith('\xFF\xD8\xFF')) {
    return 'image/jpeg';
  }
  if (data.startsWith('GIF87a') || data.startsWith('GIF89a')) {
    return 'image/gif';
  }
  if (data.startsWith('RIFF') && data.slice(8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return '';
};

export const fetchImageAsBlob = async (src: string): Promise<Blob> => {
  const response = await fetch(src);
  return response.blob();
};
