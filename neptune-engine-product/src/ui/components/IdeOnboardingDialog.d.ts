import React from 'react';
import { type IDEExtensionInstallationStatus } from '@neptune/engine-product/utils/ide.js';
interface Props {
    onDone: () => void;
    installationStatus: IDEExtensionInstallationStatus | null;
}
export declare function IdeOnboardingDialog({ onDone, installationStatus, }: Props): React.ReactNode;
export declare function hasIdeOnboardingDialogBeenShown(): boolean;
export {};
//# sourceMappingURL=IdeOnboardingDialog.d.ts.map