import { relay } from './_lib.js';
import { calculateResult } from '../src/results.js';
import { resourceInput, buildResourcePrompt } from '../src/learning-resources.js';
export default relay(({ state, dimensionId }) => {
  const d = calculateResult(state)?.dimensions.find(x => x.id === dimensionId);
  return d ? buildResourcePrompt(resourceInput(d)) : null;
});
