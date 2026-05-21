/**
 * Types barrel export - minimal stubs for CLI compatibility
 */
import {z} from 'zod/v4'

export const connectResponseSchema = () => z.object({
	sessionId: z.string().optional(),
	status: z.string().optional(),
})
