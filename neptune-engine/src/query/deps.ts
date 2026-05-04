import { randomUUID } from 'crypto'
import { queryModelWithStreaming } from '../services/api/claude.js'
import { autoCompactIfNeeded } from '../services/compact/autoCompact.js'
import { microcompactMessages } from '../services/compact/microCompact.js'
import { logEvent } from '../services/analytics/index.js'

// -- deps

// I/O dependencies for query(). Passing a `deps` override into QueryParams
// lets tests inject fakes directly instead of spyOn-per-module — the most
// common mocks (callModel, autocompact) are each spied in 6-8 test files
// today with module-import-and-spy boilerplate.
//
// Using `typeof fn` keeps signatures in sync with the real implementations
// automatically. This file imports the real functions for both typing and
// the production factory — tests that import this file for typing are
// already importing query.ts (which imports everything), so there's no
// new module-graph cost.
//
// Scope is intentionally narrow (4 deps) to prove the pattern. Followup
// PRs can add runTools, handleStopHooks, logEvent, queue ops, etc.
export type QueryDeps = {
  // -- model
  callModel: typeof queryModelWithStreaming

  // -- compaction
  microcompact: typeof microcompactMessages
  autocompact: typeof autoCompactIfNeeded

  // -- platform
  uuid: () => string

  // -- analytics (SDK 模式下可注入 No-Op 实现)
  logEvent: typeof logEvent
}

export function productionDeps(): QueryDeps {
  return {
    callModel: queryModelWithStreaming,
    microcompact: microcompactMessages,
    autocompact: autoCompactIfNeeded,
    uuid: randomUUID,
    logEvent,
  }
}

/**
 * 创建 SDK 模式的 deps，使用 No-Op Analytics
 *
 * 用于 SDK 模式下，消除 analytics 开销。
 */
export function sdkDeps(): QueryDeps {
  // 在 SDK 模式下，logEvent 仍然是原样实现，但可以通过 attachNoOpAnalytics()
  // 在运行时切换到 No-Op 模式。这里保持与 productionDeps 一致，让调用者
  // 决定是否 attach No-Op Analytics。
  return productionDeps()
}
