import {ColorDiff, ColorFile} from 'color-diff-napi'

export function expectColorDiff(): typeof ColorDiff | null {
	return ColorDiff
}

export function expectColorFile(): typeof ColorFile | null {
	return ColorFile
}
