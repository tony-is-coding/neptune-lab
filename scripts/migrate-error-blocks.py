#!/usr/bin/env python3
"""
将 reply.status(N).send({error, message [, details, requestId]}) 块迁移为
replyApiError/replyUnknownError 调用。

支持以下模式：
A) 简单形式
       return reply.status(400).send({
           error: 'VALIDATION_FAILED',
           message: '...',
       });
   →   return replyApiError(request, reply, 'VALIDATION_FAILED', '...');

B) 含 details
       return reply.status(409).send({
           error: 'STATE_CONFLICT',
           message: '...',
           details: {reason: 'xxx'},
       });
   →   return replyApiError(request, reply, 'STATE_CONFLICT', '...', {
           details: {reason: 'xxx'},
       });

C) 包含 requestId（已经在用）
       reply.status(404).send({
           error: 'RESOURCE_NOT_FOUND',
           message: '...',
           requestId: request.requestId,
       });
   →   replyApiError(request, reply, 'RESOURCE_NOT_FOUND', '...');

不支持（保留警告，需人工）：
- 通过变量构造 envelope 后调用 send（例如 reply.status(404).send(envelope)）
- statusCode 与错误码不匹配的特殊场景
- 跨多行字符串拼接的 message
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# 匹配整块 reply.status(N).send({...});
# 块体内允许：error / message / requestId / details，以任意顺序、单/双引号
BLOCK_RE = re.compile(
    r"""(?P<lead>(?:return\s+)?(?:reply|return\sreply)\.status\((?P<status>\d{3})\)\.send\(\s*\{)\s*
        (?P<body>(?:(?!^\s*\}\)\s*;).)+?)
        \s*\}\)\s*;""",
    re.MULTILINE | re.DOTALL | re.VERBOSE,
)

ERROR_RE = re.compile(r"error:\s*['\"]([A-Z_]+)['\"]")
MESSAGE_RE = re.compile(r"message:\s*(['\"][^'\"]*['\"]|`[^`]*`)")
REQUEST_ID_RE = re.compile(r"requestId:\s*[^,}\n]+")
DETAILS_RE = re.compile(r"details:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})", re.DOTALL)


def transform_block(match: re.Match[str]) -> str:
    body = match.group("body")
    err_m = ERROR_RE.search(body)
    msg_m = MESSAGE_RE.search(body)
    if not err_m or not msg_m:
        return match.group(0)  # 留给人工

    code = err_m.group(1)
    message = msg_m.group(1)
    details_m = DETAILS_RE.search(body)
    has_request_id = bool(REQUEST_ID_RE.search(body))

    # 仅迁移错误响应（4xx/5xx）
    status = int(match.group("status"))
    if status < 400:
        return match.group(0)

    # 是否包含 return 关键字
    leading_return = match.group("lead").lstrip().startswith("return")
    prefix = "return " if leading_return else ""

    if details_m:
        details_text = details_m.group(1)
        return (
            f"{prefix}replyApiError(request, reply, '{code}', {message}, "
            f"{{details: {details_text}}});"
        )
    return f"{prefix}replyApiError(request, reply, '{code}', {message});"


def ensure_imports(src: str) -> str:
    """确保文件 import 了 replyApiError/replyUnknownError。"""
    if "replyApiError" in src or "replyUnknownError" in src:
        # 已有则不重复处理
        if "from '../utils/api-error'" in src and "replyApiError" not in src:
            # 需要把现有 import 扩展
            src = re.sub(
                r"from '\.\./utils/api-error';",
                "from '../utils/api-error';",
                src,
            )
        return src

    # 找到第一个 from '*api-error*' 行，扩展
    m = re.search(r"import\s*\{([^}]*)\}\s*from\s*'(\.\.\/utils\/api-error|\.\.\/\.\.\/utils\/api-error)';", src)
    if m:
        existing = m.group(1)
        if "replyApiError" not in existing:
            new_imports = existing.rstrip(", \n") + ", replyApiError, replyUnknownError"
            src = src.replace(m.group(0), f"import {{{new_imports}}} from '{m.group(2)}';")
    else:
        # 没有 api-error import，需要在 services 之后添加
        m2 = re.search(r"^(import.*?from.*?;\n)+", src, re.MULTILINE)
        if m2:
            insertion = "import {replyApiError, replyUnknownError} from '../utils/api-error';\n"
            src = src[:m2.end()] + insertion + src[m2.end():]
    return src


def main():
    if len(sys.argv) < 2:
        print("用法: migrate-error-blocks.py <file>...", file=sys.stderr)
        sys.exit(1)

    total = 0
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"  跳过不存在的文件: {arg}", file=sys.stderr)
            continue
        original = path.read_text(encoding="utf-8")
        migrated = original
        # 多次扫描直到稳定（处理嵌套）
        prev = None
        while prev != migrated:
            prev = migrated
            migrated = BLOCK_RE.sub(transform_block, migrated)
        migrated = ensure_imports(migrated)
        if migrated != original:
            path.write_text(migrated, encoding="utf-8")
            n = original.count("reply.status(") - migrated.count("reply.status(")
            print(f"已迁移 {n} 处错误块: {arg}")
            total += n
        else:
            print(f"无错误块需要迁移: {arg}")

    print(f"\n总计迁移 {total} 个错误响应块。")


if __name__ == "__main__":
    main()
