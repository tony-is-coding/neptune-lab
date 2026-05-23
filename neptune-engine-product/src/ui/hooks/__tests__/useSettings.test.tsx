import {expect, mock, test} from 'bun:test'

const settings = {syntaxHighlightingDisabled: true}

mock.module('../../../state/AppState.js', () => ({
	useAppState: (selector: (state: {settings: typeof settings}) => typeof settings) =>
		selector({settings}),
}))

test('reactive settings hook is importable for UI components', async () => {
	const {useSettings} = await import('../useSettings.js')

	expect(useSettings).toBeFunction()
	expect(useSettings()).toBe(settings)
})
