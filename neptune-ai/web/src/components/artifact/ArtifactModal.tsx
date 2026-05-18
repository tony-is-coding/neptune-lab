import type { MessageBlock } from '../../types/chat';
import { ArtifactContent } from './ArtifactPanel';

interface ArtifactModalProps {
  block: Extract<MessageBlock, { type: 'artifact' }> | null;
  onClose: () => void;
}

/**
 * ArtifactModal — full-screen overlay modal for viewing artifact content.
 * Reuses ArtifactContent rendering logic from ArtifactPanel.
 */
export function ArtifactModal({ block, onClose }: ArtifactModalProps) {
  if (!block) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />

      {/* Modal container */}
      <div
        className="relative w-[90%] max-w-4xl max-h-[85vh] bg-ivory rounded-2xl shadow-whisper border border-border-cream flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 border-b border-border-cream flex items-center justify-between px-6 bg-ivory/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-stone">description</span>
            <span className="text-[16px] font-semibold text-charcoal truncate">{block.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] px-2.5 py-1 bg-surface-container-highest rounded-full text-charcoal font-medium">
              {block.fileType}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-stone hover:text-charcoal hover:bg-surface-container rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <ArtifactContent block={block} />
        </div>
      </div>
    </div>
  );
}
