import {useAppState} from '../../state/AppState.js'
import type {SettingsJson} from '../../utils/settings/types.js'

export function useSettings(): SettingsJson {
	return useAppState(state => state.settings)
}
