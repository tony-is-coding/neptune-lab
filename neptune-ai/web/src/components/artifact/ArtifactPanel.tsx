import type { MessageBlock } from '../../types/chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ArtifactPanelProps {
  block: Extract<MessageBlock, { type: 'artifact' }> | null;
  onClose: () => void;
}

export function ArtifactPanel({ block, onClose }: ArtifactPanelProps) {
  if (!block) return null;

  return (
    <section className="flex-1 flex flex-col bg-ivory relative mt-16 ml-4 mr-4 mb-4 rounded-2xl shadow-whisper border border-border-cream overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-border-cream flex items-center justify-between px-6 bg-ivory/90 backdrop-blur-sm z-10 w-full shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-stone">description</span>
          <span className="text-[16px] font-semibold text-charcoal">{block.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] px-2.5 py-1 bg-surface-container-highest rounded-full text-charcoal font-medium">
            {block.fileType}
          </span>
          <div className="w-px h-5 bg-border-cream mx-2" />
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
    </section>
  );
}

function ArtifactContent({ block }: { block: Extract<MessageBlock, { type: 'artifact' }> }) {
  const fileType = block.fileType.toLowerCase();

  // Table / spreadsheet rendering
  if (['.xlsx', '.csv', '.table'].includes(fileType)) {
    return <TableArtifact content={block.content} title={block.title} />;
  }

  // Code rendering
  if (['.py', '.ts', '.js', '.tsx', '.jsx', '.json', '.sql'].includes(fileType)) {
    return <CodeArtifact content={block.content} title={block.title} />;
  }

  // Document / markdown rendering
  return <DocumentArtifact content={block.content} title={block.title} />;
}

function TableArtifact({ content, title }: { content: string; title: string }) {
  // Parse mock data — content is JSON with rows
  let data: Record<string, string>[] = [];
  try {
    data = JSON.parse(content);
  } catch {
    data = [{ content }];
  }

  const columns = Object.keys(data[0] || {});

  return (
    <div>
      <h1 className="font-serif text-[30px] font-medium text-charcoal mb-6">{title}</h1>
      <div className="grid grid-cols-3 gap-6 mb-10">
        <div className="bg-surface-container-low p-6 rounded-xl border border-border-cream">
          <span className="text-[11px] font-bold text-stone uppercase tracking-widest block mb-2">Total Records</span>
          <span className="font-serif text-[30px] text-charcoal font-medium">{data.length}</span>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl border border-border-cream">
          <span className="text-[11px] font-bold text-stone uppercase tracking-widest block mb-2">Columns</span>
          <span className="font-serif text-[30px] text-charcoal font-medium">{columns.length}</span>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl border border-border-cream">
          <span className="text-[11px] font-bold text-stone uppercase tracking-widest block mb-2">Status</span>
          <span className="font-serif text-[30px] text-success font-medium">Complete</span>
        </div>
      </div>

      <div className="bg-surface-lowest rounded-xl border border-border-cream overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border-cream bg-ivory">
              {columns.map(col => (
                <th key={col} className="px-4 py-3 text-left text-[11px] font-bold text-stone uppercase tracking-wider">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-border-cream/50 last:border-0 hover:bg-ivory/50 transition-colors">
                {columns.map(col => (
                  <td key={col} className="px-4 py-3 text-charcoal">{row[col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeArtifact({ content, title }: { content: string; title: string }) {
  return (
    <div>
      <h1 className="font-serif text-[24px] font-medium text-charcoal mb-6">{title}</h1>
      <div className="bg-charcoal rounded-xl p-6 overflow-x-auto">
        <pre className="text-[13px] text-[#e8e6dc] leading-relaxed font-mono whitespace-pre">{content}</pre>
      </div>
    </div>
  );
}

function DocumentArtifact({ content, title }: { content: string; title: string }) {
  return (
    <div>
      <h1 className="font-serif text-[30px] font-medium text-charcoal mb-6">{title}</h1>
      <div className="prose prose-neutral max-w-none prose-headings:text-charcoal prose-headings:font-semibold prose-p:text-[15px] prose-p:text-charcoal/80 prose-p:leading-relaxed prose-p:my-4 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-strong:text-charcoal prose-code:text-charcoal prose-code:bg-surface-container-highest prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-charcoal prose-pre:text-[#e8e6dc] prose-pre:rounded-xl prose-pre:my-4 prose-table:text-[13px] prose-th:text-left prose-th:py-2.5 prose-th:px-4 prose-th:border-b prose-th:border-border-cream prose-th:font-semibold prose-td:py-2.5 prose-td:px-4 prose-td:border-b prose-td:border-border-cream/50 prose-hr:border-border-cream">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
