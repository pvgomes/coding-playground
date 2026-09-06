const MAX_DESCRIPTION_LENGTH = 255;

function getDescription(value) {
  return value.trim().slice(0, MAX_DESCRIPTION_LENGTH) || 'image';
}

function formatExifDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function encodeAscii(value) {
  return new TextEncoder().encode(value.replace(/[^\x20-\x7E]/g, '?'));
}

function writeUint16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = value >> 8;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function writeIfdEntry(bytes, offset, tag, type, count, value) {
  writeUint16(bytes, offset, tag);
  writeUint16(bytes, offset + 2, type);
  writeUint32(bytes, offset + 4, count);
  writeUint32(bytes, offset + 8, value);
}

export function createExifMetadata(description, date = new Date()) {
  const descriptionBytes = encodeAscii(getDescription(description) + '\0');
  const dateBytes = encodeAscii(formatExifDate(date) + '\0');
  const ifd0Offset = 8;
  const ifd0Entries = 3;
  const exifIfdOffset = ifd0Offset + 2 + ifd0Entries * 12 + 4;
  const exifEntries = 2;
  const dataOffset = exifIfdOffset + 2 + exifEntries * 12 + 4;
  const descriptionOffset = dataOffset;
  const dateOffset = descriptionOffset + descriptionBytes.length;
  const size = dateOffset + dateBytes.length;
  const tiff = new Uint8Array(size);

  tiff.set([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  writeUint16(tiff, ifd0Offset, ifd0Entries);
  writeIfdEntry(tiff, ifd0Offset + 2, 0x010e, 2, descriptionBytes.length, descriptionOffset);
  writeIfdEntry(tiff, ifd0Offset + 14, 0x0132, 2, dateBytes.length, dateOffset);
  writeIfdEntry(tiff, ifd0Offset + 26, 0x8769, 4, 1, exifIfdOffset);
  writeUint32(tiff, ifd0Offset + 38, 0);

  writeUint16(tiff, exifIfdOffset, exifEntries);
  writeIfdEntry(tiff, exifIfdOffset + 2, 0x9003, 2, dateBytes.length, dateOffset);
  writeIfdEntry(tiff, exifIfdOffset + 14, 0x9004, 2, dateBytes.length, dateOffset);
  writeUint32(tiff, exifIfdOffset + 26, 0);
  tiff.set(descriptionBytes, descriptionOffset);
  tiff.set(dateBytes, dateOffset);

  const app1Length = 6 + tiff.length + 2;
  const app1 = new Uint8Array(4 + 6 + tiff.length);
  app1.set([0xff, 0xe1, app1Length >> 8, app1Length & 0xff, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  app1.set(tiff, 10);
  return app1;
}

export function addExifMetadata(jpeg, description, date = new Date()) {
  const bytes = new Uint8Array(jpeg);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('The cleaned image could not be encoded as a JPEG.');
  }

  const metadata = createExifMetadata(description, date);
  const output = new Uint8Array(metadata.length + bytes.length);
  output.set(bytes.slice(0, 2));
  output.set(metadata, 2);
  output.set(bytes.slice(2), metadata.length + 2);
  return output;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as an image.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('The image could not be processed.'));
    }, 'image/jpeg', 0.92);
  });
}

const form = document.getElementById('cleanup-form');
const imageInput = document.getElementById('image-input');
const descriptionInput = document.getElementById('description-input');
const status = document.getElementById('cleanup-status');
const submitButton = document.getElementById('cleanup-submit');
const downloadLink = document.getElementById('download-link');
const preview = document.getElementById('cleanup-preview');
const previewImage = document.getElementById('preview-image');
let downloadUrl = null;

form.addEventListener('submit', async event => {
  event.preventDefault();
  const file = imageInput.files[0];
  if (!file) return;

  submitButton.disabled = true;
  status.textContent = 'Cleaning image...';
  downloadLink.hidden = true;
  preview.hidden = true;

  try {
    const image = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);

    const jpeg = await canvasToBlob(canvas);
    const description = getDescription(descriptionInput.value);
    const cleaned = new Blob([addExifMetadata(await jpeg.arrayBuffer(), description)], { type: 'image/jpeg' });
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(cleaned);

    previewImage.src = downloadUrl;
    previewImage.alt = description;
    preview.hidden = false;
    downloadLink.href = downloadUrl;
    downloadLink.download = `${description.replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) || 'image'}-cleaned.jpg`;
    downloadLink.hidden = false;
    status.textContent = 'Image cleaned. It contains only the new description and today’s date.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

window.addEventListener('beforeunload', () => {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
});
