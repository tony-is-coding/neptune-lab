#!/usr/bin/env bash
# verify-harness-v1.sh
#
# Harness v1.0 端到端验收脚本（Stage 6 完成后）
#
# 验证 5 类 Gate：
#   A — 干净度（engine 0 数据库 SDK，0 product 反向引用）
#   B — Harness 强化（Sandbox / Audit / Run / Observability 模块完整）
#   C — Stateless（跨实例 resume 测试通过）
#   D — SDK 三种姿势（examples 都能加载）
#   E — 量化（守门 9/9 + baseline 不退化）
#
# 用法：bash neptune-engine/scripts/verify-harness-v1.sh
# 退出码：0 = 全过；非 0 = 失败

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
		echo "    ✅ PASS"
	else
		fails=$((fails + 1))
		echo "    ❌ FAIL"
		if [ -n "$out" ]; then
			echo "$out" | head -10 | sed 's/^/      | /'
		fi
	fi
}

echo "==========================================================================="
echo "verify-harness-v1 — Harness v1.0 端到端验收"
echo "ENGINE_ROOT=$ENGINE_ROOT"
echo "==========================================================================="

# Gate A — 干净度
echo ""
echo "── Gate A: 干净度 ──────────────────────────────────────────────"
check "A.1 engine 0 数据库 SDK 依赖" "
	! grep -E '\"(postgres|drizzle-orm|ioredis|better-sqlite3|sqlite3)\"' package.json
"
check "A.2 builtin-tools 9 工具反向引用 = 0" "
	core_tools='BashTool FileEditTool FileReadTool FileWriteTool GlobTool GrepTool WebFetchTool WebSearchTool LSPTool'
	count=0
	for t in \$core_tools; do
		dir=\"packages/builtin-tools/src/tools/\$t\"
		if [ -d \"\$dir\" ]; then
			c=\$(grep -rl \"from 'src/\" \"\$dir\" 2>/dev/null | wc -l | tr -d ' ')
			count=\$((count + c))
		fi
	done
	[ \"\$count\" = '0' ]
"
check "A.3 守门脚本 9/9 PASS" "bash scripts/verify-workspace-independent.sh > /dev/null 2>&1"

# Gate B — Harness 强化
echo ""
echo "── Gate B: Harness 强化 ────────────────────────────────────────"
check "B.1 Sandbox 模块就位" "[ -f src/engine/sandbox/SandboxAdapter.ts ] && [ -f src/engine/sandbox/LocalSandbox.ts ]"
check "B.2 AuditEventStore 模块就位" "[ -f src/engine/audit/AuditEventStore.ts ] && [ -f src/engine/audit/FilesystemAuditStore.ts ]"
check "B.3 Run / RunStore 协议就位" "[ -f src/engine/run/Run.ts ] && [ -f src/engine/run/FileRunStore.ts ]"
check "B.4 Channel 协议就位" "[ -f src/engine/channel/Channel.ts ]"
check "B.5 Observability 接口就位" "[ -f src/engine/observability/ITracingProvider.ts ] && [ -f src/engine/observability/IMetricsProvider.ts ]"
check "B.6 ArtifactStore 就位" "[ -f src/engine/artifact/LocalArtifactStore.ts ]"
check "B.7 AgentRegistry 协议就位" "[ -f src/engine/agent-registry/AgentRegistry.ts ]"

# Gate C — Stateless
echo ""
echo "── Gate C: Stateless ───────────────────────────────────────────"
check "C.1 跨实例 resume 测试通过" "bun test src/engine/agent-loop/loop/__tests__/AgentLoopRunStore.test.ts > /dev/null 2>&1"
check "C.2 RunStore Filesystem 实现可用" "bun test src/engine/run > /dev/null 2>&1"

# Gate D — SDK 三种姿势
echo ""
echo "── Gate D: SDK ─────────────────────────────────────────────────"
check "D.1 sdk-pure example 可加载" "bun run examples/sdk-pure.ts 2>&1 | grep -q 'Set ANTHROPIC_API_KEY'"
check "D.2 sdk-with-fs-store example 可加载" "bun run examples/sdk-with-fs-store.ts 2>&1 | grep -q 'Set ANTHROPIC_API_KEY'"
check "D.3 sdk-with-server example 可加载" "bun run examples/sdk-with-server.ts 2>&1 | grep -q 'Set ANTHROPIC_API_KEY'"

# Gate E — 量化
echo ""
echo "── Gate E: 量化 ────────────────────────────────────────────────"
check "E.1 engine baseline 测试 ≥ 1300 pass" "
	out=\$(bun test src/engine 2>&1 | tail -5)
	pass=\$(echo \"\$out\" | grep -E '^\\s*[0-9]+ pass' | head -1 | awk '{print \$1}')
	fail=\$(echo \"\$out\" | grep -E '^\\s*[0-9]+ fail' | head -1 | awk '{print \$1}')
	[ \"\$pass\" -ge 1300 ] && [ \"\$fail\" = '0' ]
"
check "E.2 engine tsc 0 错" "bunx tsc --noEmit -p tsconfig.json --pretty false 2>&1 | grep -E 'error TS' | head -1 | grep -q '' && exit 1 || exit 0"
check "E.3 examples 文件齐全（3 个）" "[ \$(ls examples/*.ts 2>/dev/null | wc -l | tr -d ' ') -ge 3 ]"

echo ""
echo "==========================================================================="
if [ "$fails" -gt 0 ]; then
	echo "  ❌ HARNESS v1.0: $pass_count/$total pass, $fails fail"
	echo "==========================================================================="
	exit 1
fi
echo "  ✅ HARNESS v1.0: ALL GREEN ($pass_count/$total)"
echo "==========================================================================="
exit 0
