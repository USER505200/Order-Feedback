const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FEEDBACK_BUTTON_ID,
  buildFeedbackFooterText,
  buildFeedbackModalId,
  parseFeedbackModalMessageId,
  parseFeedbackWorkerIds,
} = require('../src/utils/feedbackState');

test('feedback footer keeps unique worker ids in order', () => {
  const footerText = buildFeedbackFooterText(['111', '222', '111', '333']);

  assert.equal(footerText, 'Feedback workers: 111,222,333');
  assert.deepEqual(parseFeedbackWorkerIds(footerText), ['111', '222', '333']);
});

test('feedback modal id round-trips message id', () => {
  const modalId = buildFeedbackModalId('139000111222333444');

  assert.equal(FEEDBACK_BUTTON_ID, 'feedback_submit');
  assert.equal(parseFeedbackModalMessageId(modalId), '139000111222333444');
});

test('feedback footer parser rejects unrelated values', () => {
  assert.deepEqual(parseFeedbackWorkerIds('Completed by: 123'), []);
  assert.equal(parseFeedbackModalMessageId('feedback_submit:123'), null);
});
