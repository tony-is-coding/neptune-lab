/**
 * engine/compat/featureCompat.ts
 *
 * Feature flag 兼容层
 *
 * 问题：
 * - Bun 环境下使用 `import { feature } from 'bun:bundle'` 检查 feature flag
 * - Node.js/非 Bun 环境下 `bun:bundle` 模块不可用
 *
 * 解决方案：
 * - 检测 `bun:bundle` 可用性
 * - 不可用时返回 false（feature flag 关闭）
 * - 支持通过 config 覆盖特定 flag
 */

import { LogUtil } from '../log/LogUtil.js'

// ============================================================
// Feature Override 接口
// ============================================================

/**
 * Feature flag 覆盖配置
 *
 * 用于在非 Bun 环境或测试环境中手动控制 feature flag。
 */
export interface FeatureOverride {
  /** feature flag 名称 -> 是否启用（undefined = 使用默认行为） */
  [flagName: string]: boolean | undefined
}

// ============================================================
// Bun 环境检测
// ============================================================

/** 检测是否在 Bun 环境中运行 */
function isBunEnvironment(): boolean {
  // 检测 Bun 特定的全局对象
  return typeof (globalThis as any).Bun !== 'undefined'
}

// ============================================================
// feature() 函数兼容实现
// ============================================================

/**
 * 检查 feature flag 是否启用
 *
 * 优先级：
 * 1. overrides 中明确指定的值
 * 2. Bun 环境下的 feature() 函数结果
 * 3. 非 Bun 环境默认返回 false
 *
 * @param flagName - feature flag 名称（如 'COORDINATOR_MODE'）
 * @param overrides - 可选的 feature flag 覆盖配置
 * @returns feature flag 是否启用
 */
export async function isEnabled(
  flagName: string,
  overrides?: FeatureOverride,
): Promise<boolean> {
  // 优先级 1: 检查 overrides
  if (overrides && flagName in overrides) {
    const value = overrides[flagName]
    if (value !== undefined) {
      return value
    }
  }

  // 优先级 2: Bun 环境使用原生 feature()
  if (isBunEnvironment()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { feature } = require('bun:bundle') as { feature: (name: string) => boolean }
      return feature(flagName)
    } catch (error) {
      // bun:bundle 不可用，降级到 false
      LogUtil.debug('bun:bundle 不可用', { flagName, error: String(error) })
      return false
    }
  }

  // 优先级 3: 非 Bun 环境默认返回 false
  return false
}

/**
 * 同步版本的 feature flag 检查
 *
 * 注意：此函数在 Bun 环境下也是同步的，但为了保持 API 一致性，
 * 建议使用 async 版本的 isEnabled()。
 *
 * @param flagName - feature flag 名称
 * @param overrides - 可选的 feature flag 覆盖配置
 * @returns feature flag 是否启用
 */
export function isEnabledSync(
  flagName: string,
  overrides?: FeatureOverride,
): boolean {
  // 优先级 1: 检查 overrides
  if (overrides && flagName in overrides) {
    const value = overrides[flagName]
    if (value !== undefined) {
      return value
    }
  }

  // 优先级 2: Bun 环境使用原生 feature()
  if (isBunEnvironment()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { feature } = require('bun:bundle') as { feature: (name: string) => boolean }
      return feature(flagName)
    } catch (error) {
      // bun:bundle 不可用，降级到 false
      LogUtil.debug('bun:bundle 不可用', { flagName, error: String(error) })
      return false
    }
  }

  // 优先级 3: 非 Bun 环境默认返回 false
  return false
}

// ============================================================
// 便捷函数
// ============================================================

/**
 * 创建带有固定 overrides 的 feature checker
 *
 * @param overrides - feature flag 覆盖配置
 * @returns 检查 feature flag 的函数
 */
export function createFeatureChecker(overrides: FeatureOverride) {
  return {
    /**
     * 检查 feature flag 是否启用
     */
    check: (flagName: string) => isEnabledSync(flagName, overrides),

    /**
     * 更新 overrides 配置
     */
    update: (newOverrides: Partial<FeatureOverride>) => {
      Object.assign(overrides, newOverrides)
    },
  }
}
