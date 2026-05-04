#!/usr/bin/env bun
import { $ } from 'bun'

const result = await $`du -sm dist/sdk/engine/`
console.log('stdout:', result.stdout)
console.log('stdout type:', typeof result.stdout)
const output = result.stdout.toString()
const parts = output.trim().split(/\s+/)
console.log('parts:', parts)
console.log('sizeKB:', parseInt(parts[0]))
