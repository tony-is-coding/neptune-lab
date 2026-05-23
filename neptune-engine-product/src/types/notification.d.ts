/**
 * Notification 类型定义 — 纯数据版本（零 React 依赖）
 *
 * 框架核心使用的纯数据 Notification 类型，从 React 依赖中解耦。
 * 原始类型定义在 context/notifications.tsx（含 JSXNotification 分支）。
 *
 * 核心文件只需要 TextNotification（纯文本版），不需要 JSXNotification。
 */
/**
 * 通知优先级
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'immediate';
/**
 * 基础通知接口
 *
 * 包含所有通知类型共享的字段。
 */
export interface BaseNotification {
    /** 通知唯一标识 */
    key: string;
    /**
     * 此通知使失效的通知键列表。
     * 如果通知被使失效，它将从队列中移除，
     * 如果当前正在显示，则立即清除。
     */
    invalidates?: string[];
    /** 通知优先级 */
    priority: NotificationPriority;
    /** 超时时间（毫秒） */
    timeoutMs?: number;
    /**
     * 合并具有相同键的通知，类似 Array.reduce()。
     * 当队列中或当前显示的通知与传入通知具有匹配的键时调用。
     * 返回合并后的通知（应该将 fold 向前传递以供未来合并）。
     *
     * 使用 BaseNotification 作为参数和返回类型，
     * 以支持 CLI 层的 JSXNotification 扩展。
     */
    fold?: (accumulator: any, incoming: any) => any;
}
/**
 * 文本通知
 */
export interface TextNotification extends BaseNotification {
    /** 通知文本内容 */
    text: string;
    /**
     * 文本颜色
     *
     * 注意：在核心框架中，这是 `string` 类型。
     * 在 CLI 中，这可以是 `keyof Theme` 类型。
     * 使用 `string` 类型可以兼容两种场景。
     */
    color?: string;
}
/**
 * 框架核心使用的纯数据 Notification 类型（零 React 依赖）
 *
 * 注意：这是简化版本，只包含 TextNotification。
 * 完整版本（含 JSXNotification）在 context/notifications.tsx 中。
 *
 * 为了避免与浏览器的 Notification API 冲突，这里使用 CoreNotification 作为类型名称。
 */
export type CoreNotification = TextNotification;
export type Notification = CoreNotification;
/**
 * 通知发送器接口
 *
 * 框架核心使用的通知发送抽象，零 React 依赖。
 * CLI 层可以实现此接口来提供通知功能。
 */
export interface NotificationEmitter {
    /**
     * 发送通知
     * @param notification 要发送的通知
     */
    emit(notification: CoreNotification): void;
}
/**
 * 空通知发送器实现
 *
 * 用于不需要通知功能的场景（如纯框架测试）。
 */
export declare const nullNotificationEmitter: NotificationEmitter;
//# sourceMappingURL=notification.d.ts.map