import {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {createAgent} from '../api/agents';

/**
 * 创建智能体页
 *
 * 设计原则（P0-1，2026-05-26）：
 * - 表单上每一项都必须真正进入 createAgent 提交体；不放任何不接通的"装饰性"控件
 * - 后置配置（技能 / 工具 / MCP / 知识库）由智能体配置页 (/agents/:id) 管理，
 *   避免双入口造成数据漂移
 * - 中文优先（AGENTS.md 中文优先约束）
 */

const MODEL_PRESETS = [
    {value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5（默认）'},
    {value: 'claude-opus-4', label: 'Claude Opus 4'},
    {value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5'},
];

interface FormState {
    name: string;
    description: string;
    model: string;
    systemPrompt: string;
}

interface FormErrors {
    name?: string;
    model?: string;
    systemPrompt?: string;
}

function validate(form: FormState): FormErrors {
    const errors: FormErrors = {};
    if (!form.name.trim()) errors.name = '智能体名称必填';
    if (!form.model.trim()) errors.model = '基础模型必填';
    if (!form.systemPrompt.trim()) errors.systemPrompt = '系统提示词必填';
    return errors;
}

export function CreateAgent() {
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>({
        name: '',
        description: '',
        model: MODEL_PRESETS[0].value,
        systemPrompt: '',
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const handleCreate = async () => {
        const validationErrors = validate(form);
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) return;

        setIsCreating(true);
        setCreateError(null);

        try {
            const agent = await createAgent({
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                systemPrompt: form.systemPrompt.trim(),
                modelConfig: {
                    provider: 'anthropic',
                    model: form.model.trim(),
                    temperature: 0.2,
                    maxTokens: 4096,
                },
            });
            navigate(`/agents/${agent.id}`);
        } catch (err) {
            console.error('Failed to create agent:', err);
            setCreateError(err instanceof Error ? err.message : '创建智能体失败');
            setIsCreating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface-container-low overflow-y-auto">
            <header className="sticky top-0 w-full h-16 bg-surface-container-low/90 backdrop-blur-md border-b border-surface-container-highest flex items-center px-8 z-30 shrink-0">
                <div className="flex items-center gap-2 text-stone text-sm">
                    <Link to="/agents" className="hover:text-brand transition-colors">智能体</Link>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="font-bold text-charcoal">创建智能体</span>
                </div>
            </header>

            <div className="flex-1 max-w-3xl w-full mx-auto px-8 pt-10 pb-24">
                <div className="mb-8">
                    <h1 className="font-serif text-[40px] text-charcoal">创建智能体</h1>
                    <p className="text-[18px] text-olive mt-2 max-w-2xl">
                        定义新智能体的身份与基础模型；技能、知识库、MCP 服务等高级配置可在创建后于配置页管理。
                    </p>
                </div>

                {createError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <span className="material-symbols-outlined text-red-600">error</span>
                        <p className="text-sm text-red-700">{createError}</p>
                    </div>
                )}

                <div className="space-y-8">
                    <section className="bg-ivory rounded-xl p-8 border border-border-cream shadow-whisper">
                        <h2 className="font-serif text-[24px] text-charcoal mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-stone">badge</span>
                            智能体身份
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2" htmlFor="agent-name">
                                    名称 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({...form, name: e.target.value})}
                                    className={`w-full bg-white border ${errors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-border-cream focus:border-brand focus:ring-brand'} rounded-lg px-4 py-3.5 text-charcoal focus:outline-none focus:ring-1 transition-colors placeholder:text-stone/50`}
                                    id="agent-name"
                                    placeholder="例如：财务关账助手"
                                    type="text"
                                />
                                {errors.name && <p className="text-red-500 text-xs mt-1.5">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2" htmlFor="agent-desc">
                                    描述
                                </label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({...form, description: e.target.value})}
                                    className="w-full bg-white border border-border-cream rounded-lg px-4 py-3.5 text-charcoal focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors placeholder:text-stone/50 resize-none h-24"
                                    id="agent-desc"
                                    placeholder="简要说明该智能体的使用场景与边界"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-ivory rounded-xl p-8 border border-border-cream shadow-whisper">
                        <h2 className="font-serif text-[24px] text-charcoal mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-stone">memory</span>
                            模型配置
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2" htmlFor="base-model">
                                    基础模型 <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={form.model}
                                        onChange={(e) => setForm({...form, model: e.target.value})}
                                        className={`w-full bg-white border ${errors.model ? 'border-red-500 ring-1 ring-red-500' : 'border-border-cream focus:border-brand focus:ring-brand'} rounded-lg px-4 py-3.5 appearance-none text-charcoal focus:outline-none focus:ring-1 transition-colors cursor-pointer`}
                                        id="base-model"
                                    >
                                        {MODEL_PRESETS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-stone pointer-events-none">expand_more</span>
                                </div>
                                <p className="text-xs text-stone mt-2">
                                    使用 Anthropic 提供商；可在智能体配置页调整温度、最大 Token 等参数。
                                </p>
                                {errors.model && <p className="text-red-500 text-xs mt-1.5">{errors.model}</p>}
                            </div>
                            <div>
                                <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2" htmlFor="system-prompt">
                                    系统提示词 <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={form.systemPrompt}
                                    onChange={(e) => setForm({...form, systemPrompt: e.target.value})}
                                    className={`w-full bg-white border ${errors.systemPrompt ? 'border-red-500 ring-1 ring-red-500' : 'border-border-cream focus:border-brand focus:ring-brand'} rounded-lg px-4 py-3.5 text-charcoal focus:outline-none focus:ring-1 transition-colors placeholder:text-stone/50 font-mono text-sm leading-relaxed h-48 custom-scrollbar`}
                                    id="system-prompt"
                                    placeholder="你是一名……请按照以下规则……"
                                />
                                {errors.systemPrompt ? (
                                    <p className="text-red-500 text-xs mt-1.5">{errors.systemPrompt}</p>
                                ) : (
                                    <p className="text-xs text-stone mt-2">定义智能体的核心行为、领域边界与输出风格。</p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="bg-surface-container-lowest rounded-xl p-6 border border-dashed border-stone/40">
                        <h3 className="font-serif text-[18px] text-charcoal mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-stone text-lg">build</span>
                            后置配置
                        </h3>
                        <p className="text-sm text-stone leading-relaxed">
                            技能注册、知识库挂载、工具白名单与 MCP 服务在创建后通过
                            <span className="font-medium text-charcoal">「智能体配置」</span>
                            页面管理。这避免了在创建时刻预设错误的能力组合。
                        </p>
                    </section>
                </div>
            </div>

            <div className="fixed bottom-0 right-0 left-[72px] bg-ivory border-t border-surface-container-highest p-4 px-8 flex justify-end gap-4 z-40 shadow-whisper">
                <button onClick={() => navigate(-1)} className="px-6 py-2.5 rounded-lg font-semibold text-sm text-charcoal hover:bg-surface-container-highest transition-colors">
                    取消
                </button>
                <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-brand text-white hover:bg-brand/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isCreating ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            创建中...
                        </>
                    ) : (
                        '创建智能体'
                    )}
                </button>
            </div>
        </div>
    );
}
