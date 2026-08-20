// Authoring toolkit — build-time helpers, NOT part of the browser bundle.
//
// The runtime entry (`src/index.ts`) never imports this, so nothing here ships
// to a landing page. These are the two halves of the reliable Webflow path:
// generate the quiz as one HTML block, then verify what actually published.

export {
  generateWebflowQuiz,
  validateDefinition,
  type AnswerDefinition,
  type GenerateResult,
  type QuestionDefinition,
  type QuizDefinition,
  type StepDefinition,
} from './webflow.js';

export {
  formatVerifyReport,
  verifyQuizMarkup,
  type VerifyProblem,
  type VerifyReport,
} from './verify.js';
