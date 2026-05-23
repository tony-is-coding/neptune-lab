/**
 * Tagged ID encoding compatible with the API's tagged_id.py format.
 *
 * Produces IDs like "user_01PaGUP2rbg1XDh7Z9W1CEpd" from a UUID string.
 * The format is: {tag}_{version}{base58(uuid_as_128bit_int)}
 *
 * This must stay in sync with api/api/common/utils/tagged_id.py.
 */
/**
 * Convert an account UUID to a tagged ID in the API's format.
 *
 * @param tag - The tag prefix (e.g. "user", "org")
 * @param uuid - A UUID string (with or without hyphens)
 * @returns Tagged ID string like "user_01PaGUP2rbg1XDh7Z9W1CEpd"
 */
export declare function toTaggedId(tag: string, uuid: string): string;
//# sourceMappingURL=taggedId.d.ts.map