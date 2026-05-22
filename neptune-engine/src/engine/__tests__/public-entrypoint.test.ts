import {expect, test} from 'bun:test'

test('engine public entrypoint is safe to import in headless server runtime', async () => {
	const engine = await import('../index.js')

	expect(engine.AgentEngine).toBeFunction()
	expect(engine.ProviderRegistry).toBeFunction()
	expect(engine.LogUtil).toBeFunction()
	expect(engine.createHeadlessCCRuntime).toBeFunction()
})
