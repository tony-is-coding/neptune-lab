# Agent Workflow E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-level acceptance coverage for ask_user, artifact panel, plan panel, SSE recovery, and thread stability.

**Architecture:** Extend the controlled engine as a deterministic event source, keep production engine untouched, then harden the Collaborate UI around user-visible workflow states. E2E tests assert visible behavior and persistence, not internal implementation details.

**Tech Stack:** Bun, Fastify, React, Vite, Playwright, TypeScript.

---

## File Structure

- Modify `neptune-ai/server/src/services/controlled-engine-factory.ts`: add deterministic advanced/slow/error event scenarios.
- Modify `neptune-ai/web/src/hooks/useChatMessages.ts`: expose abort and improve error/abort state recovery.
- Modify `neptune-ai/web/src/pages/Collaborate.tsx`: wire abort and clearer recovery UI through ChatInput.
- Modify `neptune-ai/web/src/components/chat/ChatInput.tsx`: add stop button when streaming.
- Add `neptune-ai/web/tests/advanced-chat.spec.ts`: ask_user/artifact/plan browser acceptance.
- Add `neptune-ai/web/tests/sse-recovery.spec.ts`: abort/401/409/404 recovery.
- Add `neptune-ai/web/tests/thread-stability.spec.ts`: refresh/switch/history persistence.
- Modify `neptune-ai/web/playwright.config.ts`: register new projects.
- Modify `neptune-ai/docs/reports/2026-05-20-full-validation-report.md`: update coverage results.

## Tasks

### Task 1: Advanced Workflow E2E Red Tests

- [x] Add `advanced-chat.spec.ts` with tests for visible question block, artifact sidebar detail, and plan progress.
- [x] Add `sse-recovery.spec.ts` with tests for abort, unauthorized chat, running-thread conflict, and missing thread.
- [x] Add `thread-stability.spec.ts` with refresh and thread switch persistence tests.
- [x] Run the new Playwright project and confirm failure against current UI/engine.

### Task 2: Controlled Engine Scenarios

- [x] Extend controlled engine query routing by prompt content.
- [x] Emit advanced workflow events using SDK-shaped tool events so existing mapper and persistence paths are exercised.
- [x] Emit slow stream for abort testing.
- [x] Run server controlled tests and add focused server tests if a mapper regression appears.

### Task 3: UI Recovery and Interaction

- [x] Wire `abortStream` from `useChatMessages` into Collaborate.
- [x] Show a stop button in `ChatInput` while streaming.
- [x] Make non-OK chat responses parse server error envelopes and show actionable text.
- [x] Ensure `isStreaming` resets on abort, 401, 409, 404, and SSE error.

### Task 4: Browser Gate and Report

- [x] Register Playwright projects.
- [x] Run web typecheck, parser unit tests, server full tests, engine focused tests.
- [x] Run controlled-chat plus new E2E projects.
- [x] Update validation report with pass/fail evidence and remaining gaps.
