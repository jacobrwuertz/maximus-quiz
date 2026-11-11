// The active rule set, in report order. Each rule is a pure LintRule and is
// exported individually for isolated unit testing.
import type { LintRule } from '../types.js';
import { conditionOrdering } from './conditionOrdering.js';
import { duplicateAnswerValue } from './duplicateAnswerValue.js';
import { duplicateQuestionKey } from './duplicateQuestionKey.js';
import { emptyQuestion } from './emptyQuestion.js';
import { orphanAnswer } from './orphanAnswer.js';
import { otherMissingInput } from './otherMissingInput.js';
import { bandCoverage, bandInvalid, bandWithoutScores, scoreInvalid } from './scoring.js';
import { showIfUnknownKey } from './showIfUnknownKey.js';
import { showIfUnknownValue } from './showIfUnknownValue.js';
import {
  emptyKey,
  kebabCase,
  missingType,
  noSteps,
  singleAnswer,
} from './structuralHygiene.js';

export const ALL_RULES: LintRule[] = [
  noSteps,
  emptyKey,
  duplicateQuestionKey,
  duplicateAnswerValue,
  emptyQuestion,
  orphanAnswer,
  otherMissingInput,
  showIfUnknownKey,
  showIfUnknownValue,
  conditionOrdering,
  scoreInvalid,
  bandInvalid,
  bandWithoutScores,
  bandCoverage,
  missingType,
  kebabCase,
  singleAnswer,
];

export {
  bandCoverage,
  bandInvalid,
  bandWithoutScores,
  scoreInvalid,
  conditionOrdering,
  duplicateAnswerValue,
  duplicateQuestionKey,
  emptyKey,
  emptyQuestion,
  kebabCase,
  missingType,
  noSteps,
  orphanAnswer,
  otherMissingInput,
  showIfUnknownKey,
  showIfUnknownValue,
  singleAnswer,
};
