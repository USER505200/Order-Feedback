const FEEDBACK_SUBMISSION_TTL_MS = Number(process.env.FEEDBACK_SUBMISSION_TTL_MS || 120000);
const feedbackSubmissionLocks = new Map();

function normalizeReviewText(reviewText) {
  return String(reviewText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function createFeedbackSubmissionKey({
  sourceMessageId,
  userId,
  reviewText,
  showName,
}) {
  return [
    String(sourceMessageId || '').trim(),
    String(userId || '').trim(),
    normalizeReviewText(reviewText),
    showName ? 'show' : 'hide',
  ].join('|');
}

function pruneExpiredFeedbackSubmissions(now = Date.now()) {
  for (const [key, expiresAt] of feedbackSubmissionLocks.entries()) {
    if (expiresAt <= now) {
      feedbackSubmissionLocks.delete(key);
    }
  }
}

function claimFeedbackSubmission(key, now = Date.now()) {
  pruneExpiredFeedbackSubmissions(now);

  if (!key || feedbackSubmissionLocks.has(key)) {
    return false;
  }

  feedbackSubmissionLocks.set(key, now + FEEDBACK_SUBMISSION_TTL_MS);
  return true;
}

function releaseFeedbackSubmission(key) {
  feedbackSubmissionLocks.delete(key);
}

module.exports = {
  FEEDBACK_SUBMISSION_TTL_MS,
  claimFeedbackSubmission,
  createFeedbackSubmissionKey,
  normalizeReviewText,
  pruneExpiredFeedbackSubmissions,
  releaseFeedbackSubmission,
};
