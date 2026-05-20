# Neptune AI E2E Observability Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trustworthy local acceptance loop proving browser core workflows work and that Langfuse/logs can explain chat execution failures.

**Architecture:** Start with deterministic local facts: Postgres/Redis, server, web, seeded identity, strict browser checks. Then add a correlation contract so one chat turn can be reconciled across browser, server logs, SSE events, persistence, and Langfuse.

**Tech Stack:** Bun, Fastify, Drizzle/Postgres, Redis, Vite/React, Playwright, Langfuse.

---

## File Structure

- Modify `neptune-ai/web/tests/helpers.ts`: replace stale ports and credentials with one canonical E2E identity; keep diagnostics focused on `localhost:3000` and `/api`.
- Modify or add focused specs in `neptune-ai/web/tests/*.spec.ts`: convert diagnostic tests into strict browser acceptance checks.
- Modify `neptune-ai/web/playwright.config.ts`: include every active spec or explicitly keep diagnostics separate.
- Create `neptune-ai/server/src/scripts/seed-e2e.ts`: idempotently seed tenant/user/agent for local acceptance.
- Modify `neptune-ai/server/src/routes/threads.ts`: emit a chat correlation id in request/SSE lifecycle.
- Modify `neptune-ai/server/src/services/observability/*`: attach correlation id and SSE lifecycle events to trace metadata.
- Create `neptune-ai/docs/reports/2026-05-19-e2e-observability-gap-report.md`: record measured coverage, failures, and missing observability evidence.

## Task 1: Local Fact Harness

**Files:**
- Inspect: `neptune-ai/server/package.json`
- Inspect: `neptune-ai/server/docker-compose.yml`
- Inspect: `neptune-ai/server/.env`
- Inspect: `neptune-ai/web/package.json`
- Inspect: `neptune-ai/web/playwright.config.ts`

- [ ] **Step 1: Verify infrastructure ports**

Run:

```bash
cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server
docker compose ps
```

Expected: Postgres is mapped to `5433`, Redis is mapped to `6380`. If stopped, start with:

```bash
cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server
docker compose up -d
```

- [ ] **Step 2: Verify Langfuse is reachable**

Run:

```bash
curl -I http://localhost:3001
```

Expected: HTTP response from local Langfuse. Record status code in the report.

- [ ] **Step 3: Verify server can start**

Run:

```bash
cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server
bun run dev
```

Expected: server listens on `localhost:3000` and exposes health/API routes without import errors.

- [ ] **Step 4: Verify web can start**

Run:

```bash
cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/web
bun run dev
```

Expected: Vite listens on `localhost:3004`.

## Task 2: Canonical E2E Identity

**Files:**
- Modify: `neptune-ai/web/tests/helpers.ts`
- Create: `neptune-ai/server/src/scripts/seed-e2e.ts`
- Inspect: `neptune-ai/server/src/db/schema.ts`

- [ ] **Step 1: Define canonical test identity**

Use this exact identity across helper code and seed script:

```ts
export const E2E_USER = {
  email: 'e2e@neptune.ai',
  password: 'NeptuneE2E2026!',
  name: 'Neptune E2E',
};

export const E2E_AGENT = {
  name: 'E2E Assistant',
  description: 'Deterministic assistant for browser acceptance.',
};
```

- [ ] **Step 2: Replace stale helper constants**

In `neptune-ai/web/tests/helpers.ts`, replace:

```ts
export const DEV_URL = 'http://localhost:1420';
export const API_URL = 'http://localhost:3002/api/v1';
```

with:

```ts
export const WEB_URL = 'http://localhost:3004';
export const API_URL = 'http://localhost:3000/api/v1';
```

- [ ] **Step 3: Update API login helper**

Make `loginViaApi(page)` post to `${API_URL}/auth/login` using `E2E_USER.email` and `E2E_USER.password`, then set `neptune-auth` on the `localhost:3004` origin.

- [ ] **Step 4: Run helper type check**

Run:

```bash
cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/web
bun run lint
```

Expected: no TypeScript errors caused by helper changes.

## Task 3: Minimal Strict Browser Suite

**Files:**
- Modify: `neptune-ai/web/tests/smoke.spec.ts`
- Modify: `neptune-ai/web/tests/auth.spec.ts`
- Modify: `neptune-ai/web/tests/navigation.spec.ts`
- Modify: `neptune-ai/web/tests/collaborate.spec.ts`
- Modify: `neptune-ai/web/tests/auth-401-recovery.spec.ts`
- Modify: `neptune-ai/web/playwright.config.ts`

- [ ] **Step 1: Keep smoke strict**

`smoke.spec.ts` must assert login page render and fail on unexpected page errors.

- [ ] **Step 2: Keep auth strict**

`auth.spec.ts` must assert successful UI login, token persistence, refresh persistence, and wrong-password error using the canonical user.

- [ ] **Step 3: Keep navigation strict**

`navigation.spec.ts` must assert authenticated access to `/`, `/agents`, and `/collaborate` with visible route state.

- [ ] **Step 4: Keep collaborate strict but deterministic**

`collaborate.spec.ts` must prove the collaborate page loads, agent selection is possible, and sending one message reaches an SSE or controlled engine path. If live LLM is unavailable, route mock SSE at the browser layer and classify live LLM as optional.

- [ ] **Step 5: Run smoke first**

Run:

```bash
cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/web
bun run test:smoke
```

Expected: smoke project passes before broader suite runs.

- [ ] **Step 6: Run full configured suite**

Run:

```bash
cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/web
bun run test
```

Expected: every active project passes or fails with a root-cause note tied to environment, product behavior, or test mismatch.

## Task 4: Langfuse Correlation Contract

**Files:**
- Modify: `neptune-ai/server/src/routes/threads.ts`
- Modify: `neptune-ai/server/src/services/thread-manager.ts`
- Modify: `neptune-ai/server/src/services/observability/tracing-event-processor.ts`
- Modify: `neptune-ai/server/src/services/observability/langfuse-tracing-provider.ts`

- [ ] **Step 1: Generate one correlation id per chat dispatch**

Use a single id for the request lifecycle:

```ts
const correlationId = crypto.randomUUID();
```

Attach it to route logs, dispatch metadata, and every SSE lifecycle event.

- [ ] **Step 2: Emit SSE lifecycle events**

Every chat stream must emit or log these states with the same id:

```text
sse_connected
sse_message
sse_done
sse_error
client_disconnect
```

- [ ] **Step 3: Add Langfuse trace metadata**

The trace metadata must include:

```ts
{
  tenantId,
  userId,
  agentId,
  threadId,
  correlationId,
}
```

- [ ] **Step 4: Verify trace isolation**

Run two concurrent chat dispatches and verify trace metadata does not cross-contaminate. If current global tracing provider prevents this, document it as a P1 defect before refactoring.

## Task 5: Coverage And Gap Report

**Files:**
- Create: `neptune-ai/docs/reports/2026-05-19-e2e-observability-gap-report.md`

- [ ] **Step 1: Record browser automation coverage**

Report exact counts:

```text
Active Playwright projects:
Active specs:
Excluded specs:
Passed:
Failed:
Skipped:
```

- [ ] **Step 2: Record functional completeness**

Classify the tested product areas:

```text
Auth:
Agent list/detail:
Collaborate/thread:
SSE rendering:
Error recovery:
Langfuse trace:
```

- [ ] **Step 3: Record observability completeness**

For one chat turn, mark whether each evidence point exists:

```text
Browser request id:
Server request log:
ThreadManager dispatch log:
SSE lifecycle log:
events.jsonl:
Langfuse trace metadata:
Generation model:
Tool result linkage:
Error status:
```

- [ ] **Step 4: Prioritize gaps**

Use P0/P1/P2:

```text
P0: blocks local acceptance.
P1: blocks trustworthy debugging or release confidence.
P2: improves coverage, developer experience, or long-term quality.
```

## Self-Review

- Spec coverage: this plan covers local startup, canonical seed identity, strict browser automation, Langfuse/SSE correlation, and gap reporting.
- Placeholder scan: no task depends on an unnamed file or undefined command.
- Type consistency: canonical constants are named once and reused by helper and seed work.
