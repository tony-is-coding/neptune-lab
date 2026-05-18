import { useMemo } from 'react';
import type { ChatMessage, MessageBlock } from '../types/chat';

export interface ArtifactInfo {
  id: string;
  title: string;
  fileType: string;
  content: string;
  size: number;
  createdAt?: string;
}

/**
 * useArtifacts — extract all artifact blocks from messages
 *
 * Returns a flat list of artifacts with computed metadata (size).
 * Memoized to avoid re-computation on every render.
 */
export function useArtifacts(messages: ChatMessage[]): ArtifactInfo[] {
  return useMemo(() => {
    const artifacts: ArtifactInfo[] = [];

    for (const msg of messages) {
      for (const block of msg.blocks) {
        if (block.type === 'artifact') {
          const artBlock = block as Extract<MessageBlock, { type: 'artifact' }>;
          artifacts.push({
            id: artBlock.id,
            title: artBlock.title,
            fileType: artBlock.fileType,
            content: artBlock.content,
            size: new Blob([artBlock.content]).size,
            createdAt: msg.createdAt,
          });
        }
      }
    }

    return artifacts;
  }, [messages]);
}
