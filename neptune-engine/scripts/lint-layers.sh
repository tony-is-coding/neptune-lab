#!/usr/bin/env bash
# 临时的层间 import 检查脚本（模拟 ESLint）
# 当 ESLint 安装后，可以用 eslint src/engine/ 替代

set -e

ENGINE_DIR="src/engine"
VIOLATIONS=0
ERROR_COUNT=0
WARN_COUNT=0
INFO_COUNT=0

echo "[Layer] 检查 L2 engine 是否依赖 L4 UI 层..."

# 检查 React import
if grep -r "from ['\"]react" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "async_hooks" | grep -q .; then
    echo "[Layer] ❌ 违规：engine 不应 import React"
    grep -r "from ['\"]react" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "async_hooks"
    VIOLATIONS=1
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

# 检查 components import
if grep -r "from ['\"].*components" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -q .; then
    echo "[Layer] ❌ 违规：engine 不应 import components"
    grep -r "from ['\"].*components" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null
    VIOLATIONS=1
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

# 检查 hooks import（排除 async_hooks 和 engine 内部 hooks 模块）
if grep -r "from ['\"].*hooks" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "async_hooks" | grep -v "./hooks/" | grep -v "from '../utils/hooks/" | grep -q .; then
    echo "[Layer] ❌ 违规：engine 不应 import hooks（UI 层）"
    grep -r "from ['\"].*hooks" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "async_hooks" | grep -v "./hooks/"
    VIOLATIONS=1
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

# 检查 screens import
if grep -r "from ['\"].*screens" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -q .; then
    echo "[Layer] ❌ 违规：engine 不应 import screens"
    grep -r "from ['\"].*screens" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null
    VIOLATIONS=1
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

# 检查 keybindings import
if grep -r "from ['\"].*keybindings" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -q .; then
    echo "[Layer] ❌ 违规：engine 不应 import keybindings"
    grep -r "from ['\"].*keybindings" "$ENGINE_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null
    VIOLATIONS=1
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

# ============================================================
# 新增：engine/ 向上穿透检查
# ============================================================

echo "[Layer] 检查 engine/ 向上级目录穿透引用..."

# P0: engine/ 中的 value import 穿透到 src/ 根
check_engine_penetration_value() {
    echo "  [P0] engine/ value import penetration 检查..."
    local p0_count=0
    local engine_files=$(find "$ENGINE_DIR" -name '*.ts' -not -path '*/__tests__/*' -not -path '*/types/*')

    while IFS= read -r file; do
        # Check for value imports (not type-only) from parent dirs
        # 重点检测 ../../ 双层上级（穿透到 src/ 根）
        local violations=$(grep -n "import.*from ['\"]\.\.\/\.\.\/" "$file" 2>/dev/null | \
            grep -v "import type" | \
            grep -v "from ['\"]\.\.\/\.\.\/types" | \
            grep -v "from ['\"]\.\.\/\.\.\/entrypoints" || true)

        # 同时检测单层 ../ 中的关键穿透（Tool、QueryEngine 等 src/ 根文件）
        local single_level=$(grep -n "import.*from ['\"]\.\.\/[^/]\+['\"]" "$file" 2>/dev/null | \
            grep -v "import type" | \
            grep -v "from ['\"]\.\.\/engine" | \
            grep -v "from ['\"]\.\.\/log" | \
            grep -v "from ['\"]\.\.\/session" | \
            grep -v "from ['\"]\.\.\/storage" | \
            grep -v "from ['\"]\.\.\/tools" | \
            grep -v "from ['\"]\.\.\/provider" | \
            grep -v "from ['\"]\.\.\/permissions" | \
            grep -v "from ['\"]\.\.\/hooks" | \
            grep -v "from ['\"]\.\.\/bridge" | \
            grep -v "from ['\"]\.\.\/bootstrap" | \
            grep -v "from ['\"]\.\.\/events" | \
            grep -v "from ['\"]\.\.\/helpers" | \
            grep -v "from ['\"]\.\.\/skill" | \
            grep -v "from ['\"]\.\.\/cc-runtime" | \
            grep -v "from ['\"]\.\.\/types" | \
            grep -v "from ['\"]\.\.\/Session" | \
            grep -v "from ['\"]\.\.\/utils" | \
            grep -v "from ['\"]\.\.\/Tool" || true)

        # 合并两层检测结果
        local all_violations="$violations$single_level"

        if [ -n "$all_violations" ]; then
            echo "    ERROR: $file"
            echo "$all_violations" | while IFS= read -r line; do
                [ -n "$line" ] && echo "      $line"
            done
            p0_count=$((p0_count + 1))
        fi
    done <<< "$engine_files"

    if [ $p0_count -gt 0 ]; then
        echo "    [P0] 发现 $p0_count 处 value import 穿透违规"
        ERROR_COUNT=$((ERROR_COUNT + p0_count))
        VIOLATIONS=1
    else
        echo "    [P0] ✅ 零 value import 穿透"
    fi
}

# P0: Dynamic requires from engine/ to parent
check_engine_penetration_require() {
    echo "  [P0] engine/ dynamic require penetration 检查..."
    local req_count=0
    local engine_files=$(find "$ENGINE_DIR" -name '*.ts' -not -path '*/__tests__/*')

    while IFS= read -r file; do
        local violations=$(grep -n "require('\.\.\/\.\.\/" "$file" 2>/dev/null || true)
        if [ -n "$violations" ]; then
            echo "    ERROR: $file"
            echo "$violations" | while IFS= read -r line; do
                echo "      $line"
            done
            req_count=$((req_count + 1))
        fi
    done <<< "$engine_files"

    if [ $req_count -gt 0 ]; then
        echo "    [P0] 发现 $req_count 处 dynamic require 穿透违规"
        ERROR_COUNT=$((ERROR_COUNT + req_count))
        VIOLATIONS=1
    else
        echo "    [P0] ✅ 零 dynamic require 穿透"
    fi
}

# P1: from '../../utils、from '../../services 的 import
check_engine_penetration_utils_services() {
    echo "  [P1] engine/ utils/services 穿透检查..."
    local p1_count=0

    # 检查 utils 穿透（排除 engine 内部）
    local utils_violations=$(grep -rn "from ['\"]\.\.\/\.\.\/utils" "$ENGINE_DIR" --include="*.ts" 2>/dev/null | \
        grep -v "__tests__" | \
        grep -v "from '../../utils/hooks" || true)

    if [ -n "$utils_violations" ]; then
        echo "    WARN: utils 穿透引用"
        echo "$utils_violations" | while IFS= read -r line; do
            echo "      $line"
        done
        p1_count=$((p1_count + 1))
    fi

    # 检查 services 穿透
    local services_violations=$(grep -rn "from ['\"]\.\.\/\.\.\/services" "$ENGINE_DIR" --include="*.ts" 2>/dev/null | \
        grep -v "__tests__" || true)

    if [ -n "$services_violations" ]; then
        echo "    WARN: services 穿透引用"
        echo "$services_violations" | while IFS= read -r line; do
            echo "      $line"
        done
        p1_count=$((p1_count + 1))
    fi

    if [ $p1_count -gt 0 ]; then
        echo "    [P1] 发现 $p1_count 类 utils/services 穿透"
        WARN_COUNT=$((WARN_COUNT + p1_count))
    else
        echo "    [P1] ✅ 零 utils/services 穿透"
    fi
}

# P2: from '../../types 的 type import（暂时 warn 不 fail）
check_engine_penetration_types() {
    echo "  [P2] engine/ types 穿透检查..."
    local p2_count=0

    local type_imports=$(grep -rn "import type.*from ['\"]\.\.\/\.\.\/types" "$ENGINE_DIR" --include="*.ts" 2>/dev/null | \
        grep -v "__tests__" || true)

    if [ -n "$type_imports" ]; then
        echo "    INFO: types type import 穿透"
        echo "$type_imports" | while IFS= read -r line; do
            echo "      $line"
        done
        p2_count=$((p2_count + 1))
    fi

    if [ $p2_count -gt 0 ]; then
        echo "    [P2] 发现 $p2_count 处 types 穿透（INFO，暂不失败）"
        INFO_COUNT=$((INFO_COUNT + p2_count))
    else
        echo "    [P2] ✅ 零 types 穿透"
    fi
}

# 执行新增检查
check_engine_penetration_value
check_engine_penetration_require
check_engine_penetration_utils_services
check_engine_penetration_types

# 汇总报告
echo ""
echo "[Layer] ========== 检查汇总 =========="
echo "  ERROR: $ERROR_COUNT"
echo "  WARN:  $WARN_COUNT"
echo "  INFO:  $INFO_COUNT"
echo "=================================="

if [ $ERROR_COUNT -gt 0 ]; then
    echo "[Layer] ❌ 发现 $ERROR_COUNT 个 P0 错误，检查失败"
    exit 1
elif [ $VIOLATIONS -eq 0 ]; then
    echo "[Layer] ✅ 零违规：engine/ 层间 import 守护检查通过"
    exit 0
else
    echo "[Layer] ⚠️  仅有 WARN/INFO，检查通过"
    exit 0
fi
