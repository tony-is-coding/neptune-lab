export function getLocalMonthYear(): string {
	const date = process.env.CLAUDE_CODE_OVERRIDE_DATE
		? new Date(process.env.CLAUDE_CODE_OVERRIDE_DATE)
		: new Date()
	return date.toLocaleString('en-US', {month: 'long', year: 'numeric'})
}
