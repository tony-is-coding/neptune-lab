import { useParams } from "react-router-dom";

export function AgentChat() {
  const { id } = useParams();

  return (
    <div className="flex flex-col h-full bg-surface-container-low p-8">
      <div className="h-16 flex items-center mb-6">
        <h1 className="font-serif font-medium text-[24px] text-charcoal capitalize">
          {id?.replace(/-/g, ' ')}
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto bg-ivory border border-surface-container-highest shadow-whisper rounded-xl p-6 mb-6">
        <div className="text-center text-stone mt-10">
          Chat interface for {id}
        </div>
      </div>
      
      <div className="bg-ivory border border-surface-container-highest rounded-xl p-2 flex items-center shrink-0">
        <input 
          type="text" 
          placeholder="Message agent..." 
          className="flex-1 bg-transparent px-4 border-none focus:outline-none text-charcoal outline-none focus:ring-0" 
        />
        <button className="w-10 h-10 rounded-lg bg-primary-container text-white flex items-center justify-center shrink-0 ml-2">
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </div>
    </div>
  );
}
