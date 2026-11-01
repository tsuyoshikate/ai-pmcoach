import { relay } from './_lib.js';
import { calculateResult } from '../src/results.js';
import { diagnosisInput, buildDiagnosisPrompt } from '../src/ai-diagnosis.js';
import { hasEnoughEvidence } from '../src/diagnosis-loader.js';
// Re-checks the whole answer record and recomputes scores; the browser's numbers are not trusted.
export default relay(({ state, dimensionId }) => {
  const d = calculateResult(state)?.dimensions.find(x => x.id === dimensionId);
  if (!d || !hasEnoughEvidence(d)) return null;
  return buildDiagnosisPrompt(diagnosisInput(d));
});
