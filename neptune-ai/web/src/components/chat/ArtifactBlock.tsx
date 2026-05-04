import type { MessageBlock } from '../../types/chat';

interface ArtifactBlockProps {
  block: Extract<MessageBlock, { type: 'artifact' }>;
  onOpen: () => void;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  '.xlsx': 'table_chart',
  '.csv': 'table_chart',
  '.py': 'code',
  '.ts': 'code',
  '.js': 'code',
  '.md': 'description',
  '.pdf': 'picture_as_pdf',
  '.png': 'image',
  '.jpg': 'image',
};

export function ArtifactBlock({ block, onOpen }: ArtifactBlockProps) {
  const icon = FILE_TYPE_ICONS[block.fileType] || 'description';

  return (
    <div
      onClick={onOpen}
      className="bg-surface-lowest p-4 rounded-xl flex items-center justify-between border border-border-cream hover:border-brand/40 cursor-pointer transition-all shadow-sm group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-charcoal">{block.title}</p>
            <span className="text-[10px] px-2 py-0.5 bg-surface-container-highest rounded-full text-stone font-medium">
              {block.fileType}
            </span>
          </div>
          <p className="text-[12px] text-stone">Generated Document</p>
        </div>
      </div>
      <button className="text-brand opacity-0 group-hover:opacity-100 transition-opacity font-medium text-[13px] px-3 py-1 bg-brand/5 rounded-lg flex items-center gap-1">
        <span>Open</span>
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </button>
    </div>
  );
}
