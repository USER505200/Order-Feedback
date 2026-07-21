const FEEDBACK_WORKERS_PREFIX = 'Feedback workers: ';
const FEEDBACK_BUTTON_ID = 'feedback_submit';
const FEEDBACK_MODAL_PREFIX = 'feedback_modal:';

function normalizeWorkerIds(workerIds) {
  return [...new Set(
    (workerIds || [])
      .map((workerId) => String(workerId || '').trim())
      .filter(Boolean),
  )];
}

function buildFeedbackFooterText(workerIds) {
  return `${FEEDBACK_WORKERS_PREFIX}${normalizeWorkerIds(workerIds).join(',')}`;
}

function parseFeedbackWorkerIds(footerText) {
  const raw = String(footerText || '');
  if (!raw.startsWith(FEEDBACK_WORKERS_PREFIX)) {
    return [];
  }

  return normalizeWorkerIds(raw.slice(FEEDBACK_WORKERS_PREFIX.length).split(','));
}

function buildFeedbackModalId(messageId) {
  return `${FEEDBACK_MODAL_PREFIX}${String(messageId || '').trim()}`;
}

function parseFeedbackModalMessageId(customId) {
  const raw = String(customId || '');
  if (!raw.startsWith(FEEDBACK_MODAL_PREFIX)) {
    return null;
  }

  const messageId = raw.slice(FEEDBACK_MODAL_PREFIX.length).trim();
  return messageId || null;
}

module.exports = {
  FEEDBACK_BUTTON_ID,
  FEEDBACK_WORKERS_PREFIX,
  buildFeedbackFooterText,
  buildFeedbackModalId,
  normalizeWorkerIds,
  parseFeedbackModalMessageId,
  parseFeedbackWorkerIds,
};
