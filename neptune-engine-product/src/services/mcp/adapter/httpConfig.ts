// Host HTTP config adapter — bridges getUserAgent/getSessionId to mcp-client's HttpConfig interface

import type {HttpConfig} from '@neptune/mcp-client'
import {getMCPUserAgent} from '../../../utils/http.js'
import {getSessionId} from '../../../engine/session/SessionContext.js'

/**
 * Creates an HttpConfig implementation using the host's user agent and session ID.
 */
export function createMcpHttpConfig(): HttpConfig {
	return {
		getUserAgent: () => getMCPUserAgent(),
		// V2 fix: SessionId type narrowing - HttpConfig 要求返回 string
		getSessionId: () => getSessionId() ?? '',
	}
}
