// Turns whatever the rep picks (a 12 MP camera shot, a screenshot, a sticker) into a small square JPEG
// data-URL before it ever leaves the phone: centre-cropped, 256×256, ~20–40 KB. That keeps the upload
// fast on a weak connection and keeps the stored photo (which also travels in the login response) light.

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const PHOTO_SIZE = 256;

export async function resizeToSquareDataUrl(file, size = PHOTO_SIZE, quality = 0.85) {
  if (!file || !/^image\//.test(file.type) || file.type === "image/svg+xml") {
    throw new Error("Choose a photo (JPEG, PNG or WebP).");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That photo is too big — choose one under 10 MB.");
  }

  let bitmap;
  try {
    // from-image: respect the camera's rotation so portraits aren't sideways
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await loadWithImageElement(file);
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that photo on this phone.");
  ctx.fillStyle = "#ffffff"; // PNGs with transparency would otherwise turn black as JPEG
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  if (bitmap.close) bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}

function loadWithImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo. Try a different one.")); };
    img.src = url;
  });
}
