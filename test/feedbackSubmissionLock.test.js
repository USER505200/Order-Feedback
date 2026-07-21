const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FEEDBACK_SUBMISSION_TTL_MS,
  claimFeedbackSubmission,
  createFeedbackSubmissionKey,
  pruneExpiredFeedbackSubmissions,
  releaseFeedbackSubmission,
} = require('../src/utils/feedbackSubmissionLock');

test('feedback submission key normalizes duplicate payloads', () => {
  const firstKey = createFeedbackSubmissionKey({
    sourceMessageId: '100',
    userId: '200',
    reviewText: 'Great   Service',
    showName: true,
  });
  const secondKey = createFeedbackSubmissionKey({
    sourceMessageId: '100',
    userId: '200',
    reviewText: ' great service ',
    showName: true,
  });

  assert.equal(firstKey, secondKey);
});

test('feedback submission lock blocks duplicates until released', () => {
  const key = `lock-test-${Date.now()}`;

  assert.equal(claimFeedbackSubmission(key, 1000), true);
  assert.equal(claimFeedbackSubmission(key, 1001), false);

  releaseFeedbackSubmission(key);

  assert.equal(claimFeedbackSubmission(key, 1002), true);
  releaseFeedbackSubmission(key);
});

test('feedback submission lock expires after ttl', () => {
  const key = `expiry-test-${Date.now()}`;
  const startAt = 5000;

  assert.equal(claimFeedbackSubmission(key, startAt), true);
  assert.equal(claimFeedbackSubmission(key, startAt + 1), false);

  pruneExpiredFeedbackSubmissions(startAt + FEEDBACK_SUBMISSION_TTL_MS + 1);

  assert.equal(claimFeedbackSubmission(key, startAt + FEEDBACK_SUBMISSION_TTL_MS + 2), true);
  releaseFeedbackSubmission(key);
});
