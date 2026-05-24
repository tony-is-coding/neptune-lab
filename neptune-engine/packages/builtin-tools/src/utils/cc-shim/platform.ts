/**
 * cc-shim/platform.ts — substrate-local 替代 src/utils/platform.js
 *
 * cc product 用 process.platform 包了若干助手函数。substrate 直接暴露相同 API。
 */

import {platform} from 'os'

export function getPlatform(): NodeJS.Platform {
	return platform()
}

export function isWindows(): boolean {
	return platform() === 'win32'
}

export function isMac(): boolean {
	return platform() === 'darwin'
}

export function isLinux(): boolean {
	return platform() === 'linux'
}
