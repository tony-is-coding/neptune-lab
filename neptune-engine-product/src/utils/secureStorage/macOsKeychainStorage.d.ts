import type { SecureStorageData } from './types.js';
export declare const macOsKeychainStorage: {
    name: string;
    read(): SecureStorageData | null;
    readAsync(): Promise<SecureStorageData | null>;
    update(data: SecureStorageData): {
        success: boolean;
        warning?: string;
    };
    delete(): boolean;
};
/**
 * Checks if the macOS keychain is locked.
 * Returns true if on macOS and keychain is locked (exit code 36 from security show-keychain-info).
 * This commonly happens in SSH sessions where the keychain isn't automatically unlocked.
 *
 * Cached for process lifetime — execaSync('security', ...) is a ~27ms sync
 * subprocess spawn, and this is called from render (AssistantTextMessage).
 * During virtual-scroll remounts on sessions with "Not logged in" messages,
 * each remount re-spawned security(1), adding 27ms/message to the commit.
 * Keychain lock state doesn't change during a CLI session.
 */
export declare function isMacOsKeychainLocked(): boolean;
//# sourceMappingURL=macOsKeychainStorage.d.ts.map