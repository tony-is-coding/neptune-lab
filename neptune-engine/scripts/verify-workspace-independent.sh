#!/usr/bin/env bash
# verify-workspace-independent.sh
#
# 守门脚本：验证 neptune-engine workspace 真正独立可分发。
#
# 9 项 check（Stage 1+2+3 完成后全绿才算 substrate 独立）：
#   1. packages/builtin-tools/src 下没有 .tsx 文件（UI 全部迁出 product）
#   2. packages/builtin-tools/src 下没有 react / @anthropic*ink import
#   3. packages/*/src 下没有 from '@neptune/engine-product' 引用
#   4. 9 个核心工具目录（Bash/FileEdit/FileRead/FileWrite/Glob/Grep/WebFetch/WebSearch/LSP）下没有 from 'src/' 反向引用
#   5. cd packages/agent-tools && bunx tsc --noEmit 0 错
#   6. cd packages/mcp-client  && bunx tsc --noEmit 0 错
#   7. cd packages/builtin-tools && bunx tsc --noEmit 0 错（最严苛 — 整个污染面收敛后才能过）
#   8. (Stage 3) neptune-engine/package.json 不含 PG/Redis/SQLite 依赖
#   9. (Stage 3) neptune-engine/src/engine/storage 下不含 Pg* / Redis* / SQLite* 实现文件
#   10. (Stage 7) packages/*/src 0 反向引用（src/ + @neptune/engine-product）— substrate 自闭环硬底线
#
# 用法：
#   cd neptune-engine && bash scripts/verify-workspace-independent.sh
#
# 失败时：以非零状态退出 + 打印每项失败详情。

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
	echo "  [check $total] $name"
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
echo "verify-workspace-independent — neptune-engine 独立性守门"
echo "ENGINE_ROOT=$ENGINE_ROOT"
echo "==========================================================================="

check "1. builtin-tools 不含 .tsx 文件" "
	count=\$(find packages/builtin-tools/src -name '*.tsx' 2>/dev/null | wc -l | tr -d ' ')
	if [ \"\$count\" != '0' ]; then
		echo \"发现 \$count 个 .tsx 文件:\"
		find packages/builtin-tools/src -name '*.tsx' 2>/dev/null | head -15
		exit 1
	fi
"

check "2. builtin-tools 不含 react / ink import" "
	out=\$(grep -rln \"from 'react'\\|from '@anthropic/ink'\\|from '@anthropic-ai/ink'\" packages/builtin-tools/src 2>/dev/null)
	if [ -n \"\$out\" ]; then
		echo \"发现以下文件含 react/ink import:\"
		echo \"\$out\" | head -15
		exit 1
	fi
"

check "3. packages/*/src 不含 @neptune/engine-product import" "
	out=\$(grep -rln \"from '@neptune/engine-product\" packages/*/src 2>/dev/null)
	if [ -n \"\$out\" ]; then
		echo \"发现以下文件反向引用 product:\"
		echo \"\$out\" | head -15
		exit 1
	fi
"

check "4. 9 个核心工具目录不含 from 'src/' 反向引用" "
	core_tools='BashTool FileEditTool FileReadTool FileWriteTool GlobTool GrepTool WebFetchTool WebSearchTool LSPTool'
	bad=''
	for t in \$core_tools; do
		dir=\"packages/builtin-tools/src/tools/\$t\"
		if [ -d \"\$dir\" ]; then
			out=\$(grep -rln \"from 'src/\" \"\$dir\" 2>/dev/null)
			if [ -n \"\$out\" ]; then
				bad=\"\$bad\\n[\$t]\\n\$out\"
			fi
		fi
	done
	if [ -n \"\$bad\" ]; then
		printf '反向引用：%b\\n' \"\$bad\" | head -30
		exit 1
	fi
"

check "5. agent-tools tsc 通过" "cd packages/agent-tools && bunx tsc --noEmit --pretty false 2>&1 | head -5"

check "6. mcp-client tsc 通过" "cd packages/mcp-client && bunx tsc --noEmit --pretty false 2>&1 | head -5"

check "7. builtin-tools tsc 通过" "cd packages/builtin-tools && bunx tsc --noEmit --pretty false 2>&1 | head -5"

check "8. neptune-engine/package.json 不含 PG/Redis/SQLite 依赖" "
	out=\$(grep -E '\"(postgres|drizzle-orm|ioredis|better-sqlite3|sqlite3)\"' package.json 2>/dev/null)
	if [ -n \"\$out\" ]; then
		echo 'engine 仍含具体后端依赖（应迁到 product）:'
		echo \"\$out\"
		exit 1
	fi
"

check "9. engine/storage 下不含 Pg/Redis/SQLite 实现文件" "
	bad=\$(find src/engine/storage -maxdepth 2 -type f \\( -name 'Pg*' -o -name 'Redis*' -o -name 'SQLite*' \\) 2>/dev/null)
	if [ -n \"\$bad\" ]; then
		echo '发现具体后端实现文件（应迁到 product）:'
		echo \"\$bad\"
		exit 1
	fi
"

check "10. packages/*/src 0 反向引用（substrate 自闭环硬底线）" "
	# 只算真正 import 行（行首是 import 关键字），排除注释
	bad_src=\$(grep -rln \"^import .*from 'src/\" packages/*/src 2>/dev/null)
	bad_product=\$(grep -rln \"from '@neptune/engine-product\" packages/*/src 2>/dev/null)
	if [ -n \"\$bad_src\" ] || [ -n \"\$bad_product\" ]; then
		echo 'packages 内反向引用（违反 substrate 自闭环底线）:'
		echo \"\$bad_src\" | head -10
		echo \"\$bad_product\" | head -5
		exit 1
	fi
"

check "11. engine/provider/ 不再有 BaseProvider / 旧 ProviderAdapter / adapters" "
	# v6.0 P0.2.C 后 substrate provider/ 只剩 types/ProviderConfigs.ts + index.ts（仅 AnthropicProviderConfig）
	bad_files=\$(find src/engine/provider -maxdepth 2 -type f -name '*.ts' \
		\\( -name 'ProviderAdapter.ts' -o -name 'ProviderRegistry.ts' \
		   -o -name 'CircuitBreaker.ts' -o -name 'BaseProviderConfig.ts' \\) 2>/dev/null)
	if [ -n \"\$bad_files\" ]; then
		echo 'engine/provider/ 仍含旧双轨实现:'
		echo \"\$bad_files\"
		exit 1
	fi
	if [ -d src/engine/provider/adapters ]; then
		echo 'engine/provider/adapters/ 仍存在（应整目录删除）:'
		ls src/engine/provider/adapters
		exit 1
	fi
"

echo "==========================================================================="
if [ "$fails" -gt 0 ]; then
	echo "  ❌ TOTAL: $pass_count/$total pass, $fails fail"
	echo "==========================================================================="
	exit 1
fi
echo "  ✅ Workspace independence: ALL GREEN ($pass_count/$total)"
echo "==========================================================================="
exit 0
