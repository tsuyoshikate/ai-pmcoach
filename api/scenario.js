import { relay } from './_lib.js';
import { scenarioInput, buildScenarioPrompt } from '../src/scenario.js';
// Only the dimension and the user's answer are taken from the browser; the task text comes from code.
export default relay(({ dimensionId, answer }) => buildScenarioPrompt(scenarioInput(dimensionId, answer)));
