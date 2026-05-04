/**
 * Session 模块统一导出
 *
 * 导出 SessionContext 相关的所有类型和函数。
 */

// SessionContext 接口和默认值工厂
export {
  type SessionContext,
  type SessionCronTask,
  createDefaultSessionContext,
} from './SessionContext.js'

// AsyncLocalStorage 管理逻辑
export {
  getSessionContext,
  getSessionId,
  getCwd,
  getOriginalCwd,
  getProjectRoot,
  getIsRemoteMode,
  getIsNonInteractiveSession,
  getIsInteractive,
  getMemoryPath,
  isSessionPersistenceDisabled,
  runInSessionContext,
  runInSessionContextAsync,
  updateSessionContext,
  getCurrentSessionId,
  getCurrentCwd,
} from './SessionContextStorage.js'

// TokenBudget 管理逻辑
export {
  getTokenBudgetState,
  initTokenBudgetState,
  getTurnOutputTokens,
  getCurrentTurnTokenBudget,
  snapshotOutputTokensForTurn,
  incrementBudgetContinuationCount,
  getBudgetContinuationCount,
  clearTokenBudgetState,
  tokenBudgetStates,
  type TokenBudgetState,
} from './TokenBudgetManager.js'
