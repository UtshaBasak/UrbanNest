// Client-side image compression for property photos. Images are stored as
// base64 data URLs, so they are resized and re-encoded as JPEG before upload
// to keep request bodies (and the database) small.

export const MAX_IMAGES = 10;
export const MAX_IMAGE_DIMENSION = 1600;
export const JPEG_QUALITY = 0.8;
// Backend accepts up to 3,000,000 chars per image; leave some headroom
export const MAX_IMAGE_CHARS = 2_500_000;
// Backend rejects when all image strings together exceed 14,000,000 chars (16 MB document limit)
export const MAX_TOTAL_IMAGE_CHARS = 14_000_000;
export const TOTAL_IMAGES_TOO_LARGE_MESSAGE = 'Images are too large in total; use fewer or smaller images';

export const totalImageChars = (images = []) => images.reduce((sum, img) => sum + (typeof img === 'string' ? img.length : 0), 0);

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    resolve(img);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error(`Could not read image "${file.name}"`));
  };
  img.src = url;
});

// Resize so the longest side is at most maxDimension and encode as JPEG.
// Resolves to a data:image/jpeg;base64 URL.
export const compressImage = async (file, { maxDimension = MAX_IMAGE_DIMENSION, quality = JPEG_QUALITY } = {}) => {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error(`"${file?.name || 'File'}" is not an image`);
  }
  const img = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // JPEG has no alpha channel; paint a white background for transparent images
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  if (dataUrl.length > MAX_IMAGE_CHARS) {
    throw new Error(`"${file.name}" is too large even after compression (max ~2.5 MB)`);
  }
  return dataUrl;
};

// Compress a list of selected files, respecting the overall image cap.
// Returns { images, errors } so callers can keep the good images and report the rest.
export const compressImageFiles = async (files, existingCount = 0) => {
  const errors = [];
  const remaining = Math.max(0, MAX_IMAGES - existingCount);
  let list = Array.from(files || []);
  if (list.length > remaining) {
    errors.push(`You can upload at most ${MAX_IMAGES} images; ${list.length - remaining} extra file(s) were ignored.`);
    list = list.slice(0, remaining);
  }
  const images = [];
  for (const file of list) {
    try {
      images.push(await compressImage(file));
    } catch (err) {
      errors.push(err.message || `Failed to process "${file.name}"`);
    }
  }
  return { images, errors };
};
