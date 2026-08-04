const path = require('node:path');

const COMPLETE_ORDER_AUTHOR_NAME = 'Complete Order';
const COMPLETE_ORDER_FOOTER_PREFIX = 'Completed by: ';
const COMPLETE_ORDER_VERSION_TAG = 'CompleteOrder:v2';
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
]);

function buildImageOptionNames(maxImages = 10) {
  const optionNames = ['image'];

  for (let index = 2; index <= maxImages; index += 1) {
    optionNames.push(`image_${index}`);
  }

  return optionNames;
}

const IMAGE_OPTION_NAMES = buildImageOptionNames();

function buildCompleteOrderFooterText(userId) {
  return `${COMPLETE_ORDER_FOOTER_PREFIX}${String(userId || '').trim()} | ${COMPLETE_ORDER_VERSION_TAG}`;
}

function parseCompleteOrderOwnerId(footerText) {
  const raw = String(footerText || '');
  if (!raw.startsWith(COMPLETE_ORDER_FOOTER_PREFIX)) {
    return null;
  }

  const ownerId = raw
    .slice(COMPLETE_ORDER_FOOTER_PREFIX.length)
    .split('|')[0]
    .trim();

  return ownerId || null;
}

function hasSupportedImageExtension(filename) {
  const extension = path.extname(String(filename || '')).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.has(extension);
}

function isImageAttachment(attachment) {
  if (!attachment) {
    return false;
  }

  return (
    String(attachment.contentType || '').toLowerCase().startsWith('image/') ||
    hasSupportedImageExtension(attachment.name)
  );
}

function collectImageAttachments(getAttachment, maxImages = IMAGE_OPTION_NAMES.length) {
  return buildImageOptionNames(maxImages)
    .map((optionName) => getAttachment(optionName, optionName === 'image'))
    .filter(Boolean);
}

function buildStoredImageName(originalName, index) {
  const extension = hasSupportedImageExtension(originalName)
    ? path.extname(String(originalName || '')).toLowerCase()
    : '.png';

  return `complete-order-${index + 1}${extension}`;
}

async function fetchAttachmentBuffer(url, fetchImpl = globalThis.fetch, timeoutMs = 30000) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is not available in this Node.js runtime.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function buildDurableFiles(attachments, fetchImpl = globalThis.fetch) {
  return Promise.all(
    attachments.map(async (attachment, index) => ({
      attachment: await fetchAttachmentBuffer(attachment.url, fetchImpl),
      name: buildStoredImageName(attachment.name, index),
    })),
  );
}

module.exports = {
  COMPLETE_ORDER_AUTHOR_NAME,
  COMPLETE_ORDER_FOOTER_PREFIX,
  COMPLETE_ORDER_VERSION_TAG,
  IMAGE_OPTION_NAMES,
  buildCompleteOrderFooterText,
  buildDurableFiles,
  buildImageOptionNames,
  buildStoredImageName,
  collectImageAttachments,
  fetchAttachmentBuffer,
  isImageAttachment,
  parseCompleteOrderOwnerId,
};
