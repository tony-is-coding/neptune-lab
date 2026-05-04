import React, { createContext, useContext, useMemo } from 'react'
import { Mailbox } from 'claude-code-best/utils/mailbox.js'

const MailboxContext = createContext<Mailbox | undefined>(undefined)

type Props = {
  children: React.ReactNode
}

/**
 * MailboxProvider - 可选的 React Context Provider
 *
 * 提供 Mailbox 实例给 React 组件树。
 * 如果不使用此 Provider，useMailbox 将返回 undefined。
 */
export function MailboxProvider({ children }: Props): React.ReactNode {
  const mailbox = useMemo(() => new Mailbox(), [])
  return (
    <MailboxContext.Provider value={mailbox}>
      {children}
    </MailboxContext.Provider>
  )
}

/**
 * useMailbox - 获取 Mailbox 实例
 *
 * @returns Mailbox 实例，如果未在 MailboxProvider 内则返回 undefined
 *
 * 注意：此函数现在返回 Mailbox | undefined，而不是抛出错误。
 * 这样可以让框架核心在没有 MailboxProvider 的情况下工作。
 */
export function useMailbox(): Mailbox | undefined {
  return useContext(MailboxContext)
}
