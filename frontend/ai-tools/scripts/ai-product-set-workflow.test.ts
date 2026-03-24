import assert from 'node:assert/strict';

import {
  deriveAiProductSetStage,
  getInitialAiProductSetState,
  resetAfterBaseModelReselect,
  resetAfterProductReplace,
} from '../src/pages/aiProductSetWorkflow.js';

const initialState = getInitialAiProductSetState();

assert.equal(
  deriveAiProductSetStage(initialState),
  'upload-empty',
  'initial workflow should start in upload-empty stage'
);

const uploadedState = {
  ...initialState,
  uploadedImageCount: 1,
};
assert.equal(deriveAiProductSetStage(uploadedState), 'upload-ready');

const baseModelGeneratingState = {
  ...uploadedState,
  isGeneratingBaseModels: true,
};
assert.equal(deriveAiProductSetStage(baseModelGeneratingState), 'base-model-generating');

const baseModelReadyState = {
  ...uploadedState,
  generatedBaseModelCount: 4,
};
assert.equal(deriveAiProductSetStage(baseModelReadyState), 'base-model-ready');

const sceneGeneratingState = {
  ...baseModelReadyState,
  isGeneratingSceneRecommendations: true,
};
assert.equal(deriveAiProductSetStage(sceneGeneratingState), 'scene-recommend-generating');

const sceneSelectState = {
  ...baseModelReadyState,
  recommendedSceneCount: 5,
};
assert.equal(deriveAiProductSetStage(sceneSelectState), 'scene-select-ready');

const resultReadyState = {
  ...sceneSelectState,
  generatedResultCount: 2,
};
assert.equal(deriveAiProductSetStage(resultReadyState), 'result-ready');

const resetAfterProduct = resetAfterProductReplace(resultReadyState);
assert.equal(resetAfterProduct.generatedBaseModelCount, 0);
assert.equal(resetAfterProduct.recommendedSceneCount, 0);
assert.equal(resetAfterProduct.generatedResultCount, 0);

const resetAfterModel = resetAfterBaseModelReselect(resultReadyState);
assert.equal(resetAfterModel.recommendedSceneCount, 0);
assert.equal(resetAfterModel.generatedResultCount, 0);

console.log('ai-product-set workflow tests passed');
