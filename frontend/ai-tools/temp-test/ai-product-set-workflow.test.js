import assert from 'node:assert/strict';
import { deriveAiProductSetStage, getInitialAiProductSetState, } from '../src/pages/aiProductSetWorkflow.js';
const initialState = getInitialAiProductSetState();
assert.equal(deriveAiProductSetStage(initialState), 'upload-empty', 'initial workflow should start in upload-empty stage');
console.log('ai-product-set workflow tests passed');
