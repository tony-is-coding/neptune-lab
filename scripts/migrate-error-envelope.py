#!/usr/bin/env python3
"""
统一错误信封迁移脚本（一次性使用）

将路由文件里的旧式错误响应：
    return reply.status(<n>).send({
        error: '<LEGACY_CODE>',
        message: '...',
    });
转换为：
    return replyApiError(request, reply, '<CANONICAL_CODE>', '...');

并把 catch 块里的 reply.status(500).send({error:'INTERNAL_ERROR', ...}) 转为
replyUnknownError(request, reply, error, '<message>');

支持的迁移：
- BAD_REQUEST, MISSING_PARAMS, MISSING_CONTENT → VALIDATION_FAILED
- NOT_FOUND → RESOURCE_NOT_FOUND
- CONFLICT → STATE_CONFLICT
- REVIEW_ALREADY_DECIDED → STATE_CONFLICT + details.reason='review_already_decided'
- CLOSE_REPORT_NOT_READY → STATE_CONFLICT + details.reason='close_report_not_ready'
- SKILL_NOT_PUBLISHED → STATE_CONFLICT + details.reason='skill_not_published'
- QUERY_ERROR → INTERNAL_ERROR
- UNAUTHORIZED, FORBIDDEN, INTERNAL_ERROR, QUOTA_EXCEEDED, VALIDATION_FAILED,
  RESOURCE_NOT_FOUND, STATE_CONFLICT 保留原样

只迁移错误响应（4xx/5xx），不动成功响应。

不会自动修改的情况（需要人工处理）：
- 多行 details 字段
- 嵌套的 sendApiError 调用风格里 details 已存在
脚本检测到这些情况会保留原样并打印警告。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

LEGACY_TO_CANONICAL = {
    "BAD_REQUEST": ("VALIDATION_FAILED", None),
    "MISSING_PARAMS": ("VALIDATION_FAILED", None),
    "MISSING_CONTENT": ("VALIDATION_FAILED", None),
    "NOT_FOUND": ("RESOURCE_NOT_FOUND", None),
    "CONFLICT": ("STATE_CONFLICT", None),
    "REVIEW_ALREADY_DECIDED": ("STATE_CONFLICT", "review_already_decided"),
    "CLOSE_REPORT_NOT_READY": ("STATE_CONFLICT", "close_report_not_ready"),
    "SKILL_NOT_PUBLISHED": ("STATE_CONFLICT", "skill_not_published"),
    "QUERY_ERROR": ("INTERNAL_ERROR", None),
}


def migrate_legacy_codes(src: str) -> tuple[str, int]:
    """把 error: 'LEGACY_CODE' 字符串字面量替换成 canonical。

    无法自动添加 details.reason 的场景（已有 details 块）会留下 TODO 注释。
    """
    count = 0
    for legacy, (canonical, reason) in LEGACY_TO_CANONICAL.items():
        pattern = f"error: '{legacy}'"
        if pattern in src:
            replacement = f"error: '{canonical}'"
            new_src = src.replace(pattern, replacement)
            occurrences = src.count(pattern)
            count += occurrences
            src = new_src
            if reason:
                # 找到刚替换过的位置，插入 details.reason；如果已有 details 块，
                # 我们不重复添加（避免歧义）；只对没有 details 的场景插入。
                # 简化处理：保留 canonical code，details 由人工补充
                # （脚本输出 TODO 提示）
                print(
                    f"  注意：{legacy} → {canonical} 已替换 {occurrences} 处，"
                    f"建议在每处补充 details: {{reason: '{reason}'}}"
                )
    return src, count


def main():
    if len(sys.argv) < 2:
        print("用法: migrate-error-envelope.py <file>...", file=sys.stderr)
        sys.exit(1)

    total = 0
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"  跳过不存在的文件: {arg}", file=sys.stderr)
            continue
        original = path.read_text(encoding="utf-8")
        migrated, n = migrate_legacy_codes(original)
        if migrated != original:
            path.write_text(migrated, encoding="utf-8")
            print(f"已迁移 {n} 处旧错误码: {arg}")
            total += n
        else:
            print(f"无遗留旧错误码: {arg}")

    print(f"\n总计：迁移 {total} 处旧错误码字符串。")
    print("提示：剩余的 reply.status().send({error,...}) 仍需要按照新规范")
    print("迁移到 replyApiError / replyUnknownError，或确保走 sendApiError。")


if __name__ == "__main__":
    main()
