# AI Product Set Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `ai-product-set` into a fixed two-column workflow page with the approved 7-step single-image flow while keeping the current visual style.

**Architecture:** Extract the workflow state and transition rules into a focused helper so the page view can stay declarative. Keep the right panel simple by reusing the static marketing preview until the final-result state, and drive left-panel sections from the workflow state.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `tsx`, Node `assert`

---

### Task 1: Add Workflow State Helpers

**Files:**
- Create: `frontend/ai-tools/src/pages/aiProductSetWorkflow.ts`
- Test: `frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { getInitialWorkflowState, deriveAiProductSetStage } from '../src/pages/aiProductSetWorkflow';

const state = getInitialWorkflowState();
assert.equal(deriveAiProductSetStage(state), 'upload-empty');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`
Expected: FAIL with module export or function-not-found error

- [ ] **Step 3: Write minimal implementation**

Create pure helpers for:
- initial state
- workflow stage derivation
- reset-after-image-replace behavior
- button label / disabled / loading derivation

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`
Expected: PASS

### Task 2: Rebuild `AiProductSet` Left Panel

**Files:**
- Modify: `frontend/ai-tools/src/pages/AiProductSet.tsx`
- Reference: `frontend/ai-tools/src/pages/aiProductSetWorkflow.ts`

- [ ] **Step 1: Extend the failing test**

Add assertions for:
- single-image-only acceptance
- base-model-success defaults to selected
- recommended-scene-success defaults to first scene
- replacing image resets downstream state

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`
Expected: FAIL on missing stage transitions

- [ ] **Step 3: Write minimal implementation**

Update the page to:
- keep fixed left/right layout
- show one uploaded-image card with replace support
- show model form, base-model card, scene list, and bottom CTA by derived workflow stage
- use mock async transitions for generating base model, scenes, and final result

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`
Expected: PASS

### Task 3: Rebuild Right Panel and Result State

**Files:**
- Modify: `frontend/ai-tools/src/pages/AiProductSet.tsx`

- [ ] **Step 1: Add a failing test case**

Extend the workflow test with final-result expectations:
- final stage only appears after scene is selected and generation completes
- final result contains downloadable output metadata

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`
Expected: FAIL on final-result derivation

- [ ] **Step 3: Write minimal implementation**

Render:
- static hero/preview content for steps 1-6
- final generated image card with download action for step 7

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`
Expected: PASS

### Task 4: Verification

**Files:**
- Modify: `frontend/ai-tools/package.json` (only if a reusable test script is needed)

- [ ] **Step 1: Run workflow test**

Run: `npx tsx frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`
Expected: PASS

- [ ] **Step 2: Run type check**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS
