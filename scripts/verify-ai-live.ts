import { chat } from '../lib/ai/model-router';

const result = await chat([
  {
    role: 'user',
    content:
      'I have ten minutes and feel distracted. Give me one short, non-medical next step.',
  },
]);

const responseLength = result.response.trim().length;
if (responseLength === 0) {
  throw new Error('The AI provider returned an empty response.');
}

console.log(
  JSON.stringify({
    status: 'PASS',
    model: result.model,
    responseLength,
    privateContextSent: false,
  })
);
