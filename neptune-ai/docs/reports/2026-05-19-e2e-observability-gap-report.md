# Neptune AI E2E And Observability Gap Report
> Date: 2026-05-19
> Environment: local Postgres `5433`, Redis `6380`, server `3000`, web `3004`, Langfuse `3001`.

## Executive Summary

The local browser acceptance loop is now partially trustworthy.

Working:

- Web login page renders.
- Unauthenticated protected routes redirect to `/login`.
- Seeded E2E user logs in through the UI.
- Auth state persists after refresh.
- Wrong password displays an error and does not create auth state.
- Agent list, Skills, Agents, Collaborate, Thread list, and history API paths are reachable through the browser.
- Langfuse server initialization succeeds against `http://localhost:3001`.

Blocked:

- Real chat/SSE execution reaches `ThreadManager` and starts the engine, but fails before assistant output with `TypeError: Requested module is not instantiated yet.`
- The root cause is engine/headless execution loading CLI/UI tool modules through `DefaultCCRuntime.getAllBaseTools()`. The observed missing UI modules were:
  - `../OffscreenFreeze.js` from `src/ui/components/shell/ShellProgressMessage.tsx`
  - `./KeybindingContext.js` from `src/ui/keybindings/useShortcutDisplay.ts`
  - `./messageActions.js` from `src/ui/components/CtrlOToExpand.tsx`
- This confirms an architecture boundary issue: server/headless engine execution is still coupled to UI imports.

## Changes Made For Testability

- Added deterministic seed script: `neptune-ai/server/src/scripts/seed-e2e.ts`.
- Seeded:
  - tenant: `Neptune E2E`
  - user: `e2e@neptune.ai`
  - agent: `E2E Assistant`
- Updated Playwright helper to use:
  - `WEB_URL=http://localhost:3004`
  - `API_URL=http://localhost:3000/api/v1`
  - canonical E2E user credentials
- Restored real auth routing:
  - `/login` renders `Login`.
  - unauthenticated protected routes redirect to `/login`.
  - removed dev auto-login from `ProtectedRoute`.
- Hardened auth tests so successful login can no longer silently pass when the user is missing.

## Browser Automation Coverage

Current configured Playwright projects:

- `smoke`
- `auth`
- `navigation`
- `collaborate`
- `api-alignment`
- `auth-401`

Current active configured tests: 21.

Specs present but not included by default:

- `agent-config.spec.ts`
- `bug2-refresh-fix.spec.ts`
- `infinite-refresh-check.spec.ts`

Verification runs:

- `bun run test:smoke`: 3 passed.
- `bun run test:auth`: 7 passed.
- `bun run test -- --project=navigation`: 10 passed including dependencies.
- `bun run test -- --workers=1 --project=collaborate`: 12 passed including dependencies after changing `loginViaApi` to wait for `domcontentloaded` and visible login form.
- `bun run lint`: passed.
- `bun test src/engine/cc-runtime/__tests__/CCRuntime.test.ts src/engine/__tests__/public-entrypoint.test.ts`: 17 passed.

Observed suite reliability:

- Default `bun run test` initially failed under 3 workers due to `page.goto('/login')` waiting for the `load` event even though the login DOM was visible.
- `loginViaApi` now uses `waitUntil: 'domcontentloaded'` plus a visible login-title wait.
- A focused `collaborate` rerun passed after this helper fix. A full 21-test rerun should still be run before treating default parallel Playwright as a release gate.

## Functional Completeness

| Area | Status | Evidence |
| --- | --- | --- |
| Auth | Mostly usable | UI login, refresh persistence, wrong-password path pass. |
| Protected routing | Usable | Unauthenticated `/` redirects to `/login`. |
| Agent list | Usable | `/` and `/agents` request Agent APIs and render seeded Agent. |
| Skills | Basic page/API usable | `/skills` calls `/api/v1/skills` successfully. |
| Collaborate shell | Basic usable | `/collaborate` redirects to seeded Agent and loads Thread list/history. |
| Thread creation | API usable | Manual `POST /agents/:agentId/threads` returned 201. |
| Chat/SSE | Blocked | SSE connects, then emits `QUERY_ERROR`. No assistant output. |
| Error recovery | Partial | 401 recovery tests pass; invalid UUID path currently returns 500. |

## Observability Completeness

One manual chat turn was executed through:

```text
POST /api/v1/agents/d03fc11b-f2fe-4211-969b-f964ea85f055/threads/:threadId/chat
```

Observed:

- Browser/API client receives `event: connected`.
- Server logs show `Query 开始`, `Engine 创建完成`, and `Engine 就绪`.
- Server logs show `Query failed` with duration and thread/tenant/agent ids.
- `events.jsonl` contains the user message.
- SSE response emits `event: error` with `QUERY_ERROR`.
- Langfuse initializes successfully at startup.

Missing:

- No correlation id in SSE payload.
- No correlation id in server request logs.
- No correlation id in `events.jsonl`.
- No SSE lifecycle events in Langfuse.
- No persisted assistant output because engine fails before generation.
- No verified Langfuse trace shape for successful `turn -> round -> generation/tool`.
- Global mutable `LangfuseTracingProvider` state remains a concurrency risk.

## Prioritized Gaps

P0:

- Fix engine/headless execution so server chat does not import UI components through base tools.
- Add a deterministic controlled engine mode for E2E so product browser acceptance does not depend on live LLM/provider behavior.
- Make chat/SSE browser test assert user message, assistant streaming output or controlled error, and input recovery.

P1:

- Add `correlationId` per chat dispatch and propagate through request log, ThreadManager, SSE, `events.jsonl`, and Langfuse metadata.
- Refactor Langfuse tracing provider to avoid global mutable trace/span state across concurrent chat requests.
- Return 404/400 for invalid UUID-style route params instead of 500.
- Include or archive currently excluded Playwright specs.
- Remove diagnostic-only tests from the release gate or convert them to strict assertions.

P2:

- Align `server/.env` default `PORT=3005` with web proxy expectation `3000`, or make web proxy configurable.
- Fix database migration drift: `drizzle-kit migrate` connects but fails because tables already exist outside migration history.
- Add a machine-readable E2E harness command that starts/checks Docker, seed, server, web, Playwright, and trace checks.
- Add Langfuse API-level verification once correlation ids exist.

## Recommended Next Step

Do not keep patching missing UI modules one by one. The repeated failures show the wrong boundary.

The clean fix is to give Neptune server a true headless engine runtime:

```text
server ThreadManager
  -> AgentEngine
  -> HeadlessCCRuntime
  -> headless-safe tools only
  -> no React/Ink/ui imports
```

After that, add controlled engine mode and a strict Playwright `collaborate-chat.spec.ts` that proves one full browser chat turn and its trace contract.
