# Neptune AI E2E And Observability Design
> Date: 2026-05-19
> Scope: Local browser automation, server/web startup validation, logging and Langfuse observability acceptance.

## Goal

Establish a minimal trustworthy local acceptance loop for Neptune AI.

The loop must prove that a real browser user can exercise the core product path, and that server logs plus Langfuse can explain the path when it succeeds or fails.

The core evidence chain is:

```text
Browser -> Web :3004 -> Server :3000 -> Postgres/Redis -> ThreadManager
  -> Engine or controlled fake engine -> SSE -> UI -> Langfuse :3001
```

This work is not a generic "run more tests" effort. A test only counts if it gives actionable evidence about whether the business workflow works. A trace only counts if it helps answer where a user-facing failure happened.

## Current Facts

- `neptune-ai/server` runs with Bun/Fastify and defaults to server port `3000`.
- `neptune-ai/web` runs Vite on port `3004` and proxies `/api` to `http://localhost:3000`.
- Local infrastructure is Postgres on `5433` and Redis on `6380` via `neptune-ai/server/docker-compose.yml`.
- Local Langfuse is available at `http://localhost:3001/project/cmp4xgycg0006qn07v2nbtlcv`; server `LANGFUSE_BASE_URL` should be `http://localhost:3001`.
- Existing Playwright config runs six projects and twenty-one tests, but several specs are excluded, credentials are inconsistent, and some tests are diagnostic rather than assertive.
- Existing Langfuse integration creates traces from dispatch events, but SSE lifecycle, trace correlation, tool-result linkage, actual model attribution, and concurrent request safety are incomplete.

## Design Principles

1. **Start from a real local fact loop.** Theory follows observed failures, not the other way around.
2. **Prefer a small strict suite over a large vague suite.** A failing smoke test should point at one broken product capability.
3. **Separate product acceptance from model quality.** Basic browser acceptance should not depend on live LLM behavior, cost, prompt quality, or network variance.
4. **Observability is part of the product contract.** If a chat turn fails, the system must expose where it failed across browser, server, engine, SSE, persistence, and Langfuse.
5. **No stale implicit knowledge.** Ports, credentials, seeded data, health checks, and trace ids must be programmatic, not tribal memory.

## Phase 1: Minimal Fact Loop

Phase 1 builds a deterministic local harness.

### Harness Responsibilities

The harness should:

- Start Postgres and Redis using server Docker Compose.
- Verify Langfuse is reachable at `http://localhost:3001`.
- Run database migrations.
- Seed deterministic tenant, user, and Agent data.
- Start server on `3000`.
- Start web on `3004`.
- Wait for server health and web readiness.
- Run the minimal Playwright acceptance suite.
- Collect browser diagnostics, server logs, SSE transcript, and Langfuse correlation evidence.
- Emit a concise acceptance summary.

### Seed Data

Use one canonical test identity for E2E:

- Tenant: `Neptune E2E`
- User: `e2e@neptune.ai`
- Password: `NeptuneE2E2026!`
- Agent: `E2E Assistant`

The seed step should be idempotent. It should either clean the test tenant namespace or upsert records safely.

Current credential drift must be removed from E2E helpers:

- `terrence@neptune.ai / Neptune2024!`
- `test@neptune.ai / Test1234!`
- `admin@neptune.ai / admin`

Only the canonical identity should be used for automated browser acceptance unless a test explicitly validates another role.

### Controlled Engine Mode

The minimal browser suite should default to a controlled engine mode rather than a live LLM.

The controlled mode must simulate real SDK event shapes:

- thinking
- text delta
- tool use
- tool result
- done
- error

This keeps product acceptance focused on routing, persistence, SSE mapping, UI rendering, and observability. Live LLM testing can exist as a separate optional suite.

## Phase 1 Browser Acceptance Matrix

### Smoke

Purpose: prove the web app boots and the login screen is usable.

Required assertions:

- `/login` renders without page errors.
- The login form accepts input.
- Sign-up mode toggle works if the UI exposes it.
- No unexpected JavaScript errors are emitted.

### Auth

Purpose: prove a user can authenticate and remain authenticated.

Required assertions:

- Seeded user can log in through UI.
- Access token and user state are stored in `localStorage`.
- Refreshing the page preserves authenticated state.
- Wrong password shows an explicit error.
- Invalid token is cleared and redirects to `/login`.

### Agent Navigation

Purpose: prove core product surfaces can load authenticated data.

Required assertions:

- `/` loads seeded Agent list.
- `/agents` loads Agent management view.
- `/agents/:id` loads seeded Agent detail/config view.
- Sidebar navigation changes routes and active state.

### Collaborate And Thread

Purpose: prove the main product workflow works.

Required assertions:

- `/collaborate` loads the collaborate surface.
- Seeded Agent can be selected.
- A Thread can be created or opened.
- Sending one message creates a visible user message.
- Controlled SSE response renders streaming assistant output.
- Tool use and tool result states render if emitted by the controlled engine.
- Done state returns the input to usable state.

### Error Smoke

Purpose: prove failures are user-visible and diagnosable.

Required assertions:

- Controlled engine error produces a visible UI error.
- SSE error produces a visible UI error and no infinite loading state.
- Server returns structured error data where applicable.

## Phase 2: Coverage And Regression System

Phase 2 hardens the suite after the minimal fact loop is green.

### Playwright Configuration

The default `playwright test` should include every active spec or explicitly exclude archived specs by naming them as archived. Current excluded specs must be resolved:

- `agent-config.spec.ts`
- `bug2-refresh-fix.spec.ts`
- `infinite-refresh-check.spec.ts`

Diagnostic-only specs should either become strict assertions or move to a manual diagnostics command.

### Test Categories

Use explicit categories:

- `smoke`: must run before every local acceptance.
- `auth`: login/session recovery.
- `agent`: Agent list/detail/config.
- `collaborate`: Thread and SSE workflow.
- `observability`: trace/log/SSE correlation checks.
- `regression`: prior bug checks such as infinite refresh.
- `live-llm`: optional, slow, credential-gated.

### Release Gate

A local release candidate is not acceptable unless:

- smoke, auth, agent, collaborate, and observability categories pass.
- browser console has no unexpected errors.
- server logs contain no unhandled error for the tested path.
- Langfuse trace contract is satisfied for the chat turn.

## Observability Contract

Every chat dispatch must have a correlation id. The same id should appear in:

- browser network request or SSE payload metadata
- server request log
- ThreadManager dispatch log
- SSE lifecycle log
- persisted event transcript
- Langfuse trace metadata

### Required Langfuse Trace Shape

One chat turn should produce one trace:

```text
trace: query
  metadata: tenantId, userId, agentId, threadId, correlationId
  input: user message
  span: turn
    span: round-1
      generation: model call
      span/event: thinking
      span: tool_use
      span: tool_result
    event: sse_connected
    event: sse_message
    event: sse_done or sse_error
```

### Required Generation Metadata

Generation observations must include:

- actual provider model from streamed model metadata when available
- configured fallback model
- resolved system prompt or a secure reference to it
- user input
- output text
- token usage
- latency
- error metadata if failed

### Required Tool Metadata

Tool observations must include:

- `tool_use_id`
- tool name
- input
- output or error
- duration
- status

### Concurrency Requirement

Tracing must be request-scoped. A global mutable `currentTrace` or `currentRoundSpan` can cross-contaminate concurrent chats and is not acceptable for long-term correctness. The design should move toward per-dispatch tracing context or an explicit trace session object.

## Failure Taxonomy

Acceptance output should classify failures into one of these stages:

- `infra`: Postgres, Redis, Langfuse, ports, migrations
- `server_start`: server cannot boot or health check fails
- `web_start`: Vite cannot boot or web health fails
- `seed`: deterministic test data cannot be created
- `auth`: login/session/token recovery fails
- `agent`: Agent list/detail/config fails
- `thread`: Thread create/open/history fails
- `sse`: connected/message/done/error lifecycle fails
- `ui_render`: browser receives data but UI does not render it
- `observability`: logs or Langfuse cannot correlate the turn

This taxonomy should be printed in the final local acceptance summary.

## Out Of Scope

The first implementation plan should not attempt to solve:

- full browser coverage of every page
- visual regression snapshots
- load testing
- production deployment observability
- live LLM quality evaluation
- billing correctness
- full engine/UI architectural decoupling

Those are valid later work, but they should not block the first trustworthy local loop.

## Acceptance Criteria

The design is implemented when:

1. A single command can prepare infra, start server/web, run minimal E2E, and print an acceptance summary.
2. The canonical E2E user and Agent are seeded deterministically.
3. Playwright verifies login, Agent navigation, Collaborate, Thread, controlled SSE success, and controlled SSE error.
4. The test run writes browser diagnostics and SSE transcript artifacts.
5. Server logs include correlation id for request, dispatch, and SSE lifecycle.
6. Langfuse receives a trace for the tested chat turn in local project `cmp4xgycg0006qn07v2nbtlcv`.
7. The trace contains tenant/user/agent/thread/correlation metadata.
8. Concurrent chat trace contamination is either fixed or explicitly detected by an observability test.
9. The previous stale port and credential mismatches are removed from active tests.
10. Excluded Playwright specs are either wired into config or intentionally archived.

## Implementation Phases

### Phase A: Local Harness And Seeds

Create the startup and seed path. Do not expand browser coverage until the app can reliably start and seed data.

### Phase B: Minimal Browser Suite

Replace fragile diagnostic paths with strict Playwright assertions for the core workflow.

### Phase C: Observability Correlation

Add correlation id propagation and Langfuse trace contract checks.

### Phase D: Coverage Cleanup

Reconcile excluded specs, stale credentials, stale ports, and existing reports.

### Phase E: Optional Live LLM Check

Add a manually invoked live LLM smoke after the deterministic controlled-engine suite is stable.
