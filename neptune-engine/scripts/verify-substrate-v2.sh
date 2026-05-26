#!/usr/bin/env bash
# verify-substrate-v2.sh
#
# v5.0 substrate v2 守门 - 5 Gate ~41 项含 functional substrate 端到端 check
#
# 区别于 v1.0/v2.0 守门（80% 工程洁癖检查 + 0 项功能契约）：
# - Gate A 干净度（13 项）保留 v2.0 11 项 + 新增 2 项相对反向引用 / 调试残留
# - Gate B 协议契约（10 项）替代 v1 [-f file.ts] 文件存在 check，跑各模块测试套
# - Gate C 工具调度（5 项）v1 完全缺失，验证多 tool_use / Permission / Hook
# - Gate D 端到端功能（9 项）红线 #5 关键 - functional substrate 真验证
# - Gate E 量化基线（4 项）含 packages 测试基线
#
# 用法: bash scripts/verify-substrate-v2.sh
# 退出码: 0 全过 / 非 0 失败

set +e
cd "$(dirname "$0")/.."
ENGINE_ROOT="$(pwd)"

fails=0
pass_count=0
total=0

check() {
	local name="$1"
	shift
	total=$((total + 1))
	echo "  [Gate $total] $name"
	local out
	out=$(bash -c "$*" 2>&1)
	local code=$?
	if [ $code -eq 0 ]; then
		pass_count=$((pass_count + 1))
		echo "    PASS"
	else
		fails=$((fails + 1))
		echo "    FAIL"
		if [ -n "$out" ]; then
			echo "$out" | head -10 | sed 's/^/      | /'
		fi
	fi
}

echo "==========================================================================="
echo "verify-substrate-v2 - v5.0 守门（5 Gate ~41 项 含 functional substrate）"
echo "ENGINE_ROOT=$ENGINE_ROOT"
echo "==========================================================================="

# ============================================================
# Gate A 干净度 (13 项)
# ============================================================
echo ""
echo "-- Gate A: 干净度 --"

check "A.1 builtin-tools 不含 .tsx 文件" "
	count=\$(find packages/builtin-tools/src -name '*.tsx' 2>/dev/null | wc -l | tr -d ' ')
	[ \"\$count\" = '0' ]
"

check "A.2 builtin-tools 不含 react / ink import" "
	out=\$(grep -rln \"from 'react'\\|from '@anthropic/ink'\\|from '@anthropic-ai/ink'\" packages/builtin-tools/src 2>/dev/null)
	[ -z \"\$out\" ]
"

check "A.3 packages/*/src 不含 @neptune/engine-product import" "
	out=\$(grep -rln \"from '@neptune/engine-product\" packages/*/src 2>/dev/null)
	[ -z \"\$out\" ]
"

check "A.4 9 核心工具目录不含 from 'src/' 反向引用" "
	core_tools='BashTool FileEditTool FileReadTool FileWriteTool GlobTool GrepTool WebFetchTool WebSearchTool LSPTool'
	bad=''
	for t in \$core_tools; do
		dir=\"packages/builtin-tools/src/tools/\$t\"
		if [ -d \"\$dir\" ]; then
			out=\$(grep -rln \"from 'src/\" \"\$dir\" 2>/dev/null)
			[ -n \"\$out\" ] && bad=\"\$bad \$out\"
		fi
	done
	[ -z \"\$bad\" ]
"

check "A.5 agent-tools tsc 通过" "cd packages/agent-tools && bunx tsc --noEmit --pretty false 2>&1 | grep -c 'error TS' | grep -q '^0\$'"

check "A.6 mcp-client tsc 通过" "cd packages/mcp-client && bunx tsc --noEmit --pretty false 2>&1 | grep -c 'error TS' | grep -q '^0\$'"

check "A.7 engine 顶层 tsc 0 错" "
	bunx tsc --noEmit -p tsconfig.json --pretty false 2>&1 | grep -c 'error TS' | grep -q '^0\$'
"

check "A.8 engine package.json 不含 PG/Redis/SQLite 依赖" "
	! grep -E '\"(postgres|drizzle-orm|ioredis|better-sqlite3|sqlite3)\"' package.json
"

check "A.9 engine/storage 不含 Pg/Redis/SQLite 实现文件" "
	bad=\$(find src/engine/storage -maxdepth 2 -type f \\( -name 'Pg*' -o -name 'Redis*' -o -name 'SQLite*' \\) 2>/dev/null)
	[ -z \"\$bad\" ]
"

check "A.10 packages/*/src 0 反向引用 from 'src/' (substrate 自闭环硬底线)" "
	bad=\$(grep -rln \"^import .*from 'src/\" packages/*/src 2>/dev/null)
	[ -z \"\$bad\" ]
"

check "A.11 engine/provider/adapters 仅含 Anthropic + Base" "
	bad=\$(find src/engine/provider/adapters -maxdepth 1 -type f -name '*.ts' \\
		| grep -v 'AnthropicProvider.ts' | grep -v 'BaseProvider.ts' | head -5)
	[ -z \"\$bad\" ]
"

check "A.12 packages/*/src 5 级相对反向引用 (../../../../../src/) = 0" "
	bad=\$(grep -rln \"from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/\" packages/*/src 2>/dev/null \
		| xargs -I {} grep -l \"^import\" {} 2>/dev/null \
		| xargs -I {} grep -E \"^import .*from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/\" {} 2>/dev/null \
		| head -5)
	[ -z \"\$bad\" ]
"

check "A.13 调试残留 console.log/TODO/FIXME 上限 (200 个)" "
	count=\$(grep -rn 'console.log\\|FIXME' src/engine packages/*/src 2>/dev/null | wc -l | tr -d ' ')
	[ \"\$count\" -lt 200 ]
"

# ============================================================
# Gate B 协议契约 (10 项 - 跑各模块测试套)
# ============================================================
echo ""
echo "-- Gate B: 协议契约 --"

check "B.1 agent-loop 测试套" "bun test src/engine/agent-loop > /dev/null 2>&1"

check "B.2 run/RunStore 测试套（含 cross-instance resume）" "bun test src/engine/run > /dev/null 2>&1"

check "B.3 audit 测试套" "bun test src/engine/audit > /dev/null 2>&1"

check "B.4 sandbox 测试套" "bun test src/engine/sandbox > /dev/null 2>&1"

check "B.5 governance 测试套" "bun test src/engine/governance > /dev/null 2>&1"

check "B.6 observability 测试套" "bun test src/engine/observability > /dev/null 2>&1"

check "B.7 agent-registry 测试套（含 4 baseline manifests）" "bun test src/engine/agent-registry > /dev/null 2>&1"

check "B.8 memory 测试套（含 AgentScopedMemoryStore）" "bun test src/engine/memory > /dev/null 2>&1"

check "B.9 skill 测试套" "bun test src/engine/skill > /dev/null 2>&1"

check "B.10 teammate 测试套（含 TeammateChannel + StructuredMessage）" "bun test src/engine/teammate > /dev/null 2>&1"

# ============================================================
# Gate C 工具调度 (5 项 - v1 完全缺失)
# ============================================================
echo ""
echo "-- Gate C: 工具调度 --"

check "C.1 e2e/multiTool 一轮多 tool_use 测试" "bun test src/engine/agent-loop/loop/__tests__/e2e/multiTool.e2e.test.ts > /dev/null 2>&1"

check "C.2 PermissionMode 5x5 决策矩阵测试" "bun test src/engine/permissions > /dev/null 2>&1"

check "C.3 HookSurface 5 event 串联测试" "bun test src/engine/agent-loop/hook > /dev/null 2>&1"

check "C.4 11 kernel tool 协议联动" "bun test packages/builtin-tools/src/tools/kernel > /dev/null 2>&1"

check "C.5 ToolDispatcher 测试套" "bun test src/engine/agent-loop/dispatcher > /dev/null 2>&1"

# ============================================================
# Gate D 端到端功能 (9 项 - 红线 #5 关键)
# ============================================================
echo ""
echo "-- Gate D: 端到端功能 (functional substrate) --"

check "D.1 ScriptedProvider AgentLoop 完整 turn" "bun test src/engine/agent-loop/loop/__tests__/AgentLoop.test.ts > /dev/null 2>&1"

check "D.2 AgentTool e2e: spawn sub-agent → result 回填 (P0.1)" "bun test packages/builtin-tools/src/tools/AgentTool/__tests__/AgentTool.e2e.test.ts > /dev/null 2>&1"

check "D.3 SkillTool e2e: invoke skill → sub-agent → result (P0.2)" "bun test packages/builtin-tools/src/tools/SkillTool/__tests__/SkillTool.e2e.test.ts > /dev/null 2>&1"

check "D.4 TeammateChannel e2e: mailbox + broadcast + structured message" "bun test src/engine/teammate/__tests__/InMemoryTeammateChannel.test.ts > /dev/null 2>&1"

check "D.5 SendMessageTool e2e: 走 substrate TeammateChannel (P0.5)" "bun test packages/builtin-tools/src/tools/SendMessageTool/__tests__/SendMessageTool.e2e.test.ts > /dev/null 2>&1"

check "D.6 跨实例 resume e2e: AgentLoopRunStore + resumeSubAgent (P0.3)" "
	bun test src/engine/agent-loop/loop/__tests__/AgentLoopRunStore.test.ts > /dev/null 2>&1 && \
	bun test packages/builtin-tools/src/tools/AgentTool/__tests__/resumeSubAgent.e2e.test.ts > /dev/null 2>&1
"

check "D.7 Async background launch e2e (P0.3)" "bun test packages/builtin-tools/src/tools/AgentTool/__tests__/runSubAgentBackground.e2e.test.ts > /dev/null 2>&1"

check "D.8 AgentEngine.useAgentLoop 集成 e2e (P0.1)" "bun test src/engine/__tests__/AgentEngine.useAgentLoop.test.ts > /dev/null 2>&1"

check "D.9 AgentLoopBridge LoopEvent → SDK QueryEvent (P0.1a)" "
	bun test src/engine/bridge/__tests__/AgentLoopBridge.test.ts > /dev/null 2>&1 && \
	bun test src/engine/bridge/__tests__/runQueryViaAgentLoop.e2e.test.ts > /dev/null 2>&1
"

# ============================================================
# Gate E 量化基线 (4 项)
# ============================================================
echo ""
echo "-- Gate E: 量化基线 --"

check "E.1 engine baseline >= 1400 pass / 0 fail" "
	out=\$(bun test src/engine 2>&1 | tail -5)
	pass=\$(echo \"\$out\" | grep -E '^ +[0-9]+ pass' | head -1 | awk '{print \$1}')
	fail=\$(echo \"\$out\" | grep -E '^ +[0-9]+ fail' | head -1 | awk '{print \$1}')
	[ \"\$pass\" -ge 1400 ] && [ \"\$fail\" = '0' ]
"

check "E.2 builtin-tools 关键工具测试不退化（AgentTool >= 20 + SkillTool >= 12）" "
	out_a=\$(bun test packages/builtin-tools/src/tools/AgentTool 2>&1 | tail -5)
	out_s=\$(bun test packages/builtin-tools/src/tools/SkillTool 2>&1 | tail -5)
	pass_a=\$(echo \"\$out_a\" | grep -E '^ +[0-9]+ pass' | head -1 | awk '{print \$1}')
	pass_s=\$(echo \"\$out_s\" | grep -E '^ +[0-9]+ pass' | head -1 | awk '{print \$1}')
	[ \"\$pass_a\" -ge 20 ] && [ \"\$pass_s\" -ge 12 ]
"

check "E.3 SDK examples 文件齐全（3 个）" "
	[ \$(ls examples/*.ts 2>/dev/null | wc -l | tr -d ' ') -ge 3 ]
"

check "E.4 守门套娃 - v1 守门也通过" "bash scripts/verify-workspace-independent.sh > /dev/null 2>&1"

# ============================================================
echo ""
echo "==========================================================================="
if [ "$fails" -gt 0 ]; then
	echo "  v5.0 substrate v2: $pass_count/$total pass, $fails fail"
	echo "==========================================================================="
	exit 1
fi
echo "  v5.0 substrate v2: ALL GREEN ($pass_count/$total)"
echo "  - Gate A 干净度: 13/13"
echo "  - Gate B 协议契约: 10/10"
echo "  - Gate C 工具调度: 5/5"
echo "  - Gate D 端到端功能: 9/9 (红线 #5 functional substrate 验证)"
echo "  - Gate E 量化基线: 4/4"
echo "==========================================================================="
exit 0
