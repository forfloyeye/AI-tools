export type AiProductSetWorkflowStage =
  | 'upload-empty'
  | 'upload-ready'
  | 'base-model-generating'
  | 'base-model-ready'
  | 'scene-recommend-generating'
  | 'scene-select-ready'
  | 'result-ready';

export type AiProductSetWorkflowState = {
  uploadedImageCount: number;
  isGeneratingBaseModels: boolean;
  generatedBaseModelCount: number;
  isGeneratingSceneRecommendations: boolean;
  recommendedSceneCount: number;
  selectedSceneCount: number;
  isGeneratingResults: boolean;
  generatedResultCount: number;
};

export function getInitialAiProductSetState(): AiProductSetWorkflowState {
  return {
    uploadedImageCount: 0,
    isGeneratingBaseModels: false,
    generatedBaseModelCount: 0,
    isGeneratingSceneRecommendations: false,
    recommendedSceneCount: 0,
    selectedSceneCount: 0,
    isGeneratingResults: false,
    generatedResultCount: 0,
  };
}

export function deriveAiProductSetStage(
  state: AiProductSetWorkflowState,
): AiProductSetWorkflowStage {
  if (state.uploadedImageCount <= 0) {
    return 'upload-empty';
  }

  if (state.isGeneratingBaseModels) {
    return 'base-model-generating';
  }

  if (state.generatedBaseModelCount <= 0) {
    return 'upload-ready';
  }

  if (state.isGeneratingSceneRecommendations) {
    return 'scene-recommend-generating';
  }

  if (state.recommendedSceneCount <= 0) {
    return 'base-model-ready';
  }

  if (state.generatedResultCount > 0) {
    return 'result-ready';
  }

  return 'scene-select-ready';
}

export function resetAfterProductReplace(state: AiProductSetWorkflowState): AiProductSetWorkflowState {
  return {
    ...state,
    isGeneratingBaseModels: false,
    generatedBaseModelCount: 0,
    isGeneratingSceneRecommendations: false,
    recommendedSceneCount: 0,
    selectedSceneCount: 0,
    isGeneratingResults: false,
    generatedResultCount: 0,
  };
}

export function resetAfterBaseModelReselect(state: AiProductSetWorkflowState): AiProductSetWorkflowState {
  return {
    ...state,
    isGeneratingSceneRecommendations: false,
    recommendedSceneCount: 0,
    selectedSceneCount: 0,
    isGeneratingResults: false,
    generatedResultCount: 0,
  };
}

export function derivePrimaryActionLabel(stage: AiProductSetWorkflowStage, selectedSceneCount: number): string {
  if (stage === 'upload-empty') {
    return '请先上传服装图片';
  }

  if (stage === 'upload-ready' || stage === 'base-model-generating') {
    return stage === 'base-model-generating' ? '基准模特生成中...' : '生成基准模特';
  }

  if (stage === 'base-model-ready' || stage === 'scene-recommend-generating') {
    return stage === 'scene-recommend-generating' ? '推荐场景生成中...' : '生成推荐场景';
  }

  if (stage === 'scene-select-ready') {
    return selectedSceneCount > 0 ? `生成场景图片（${selectedSceneCount}张）` : '请选择场景';
  }

  return '下载结果图片';
}
