# Neptune AI 后端自动化测试

## 触发
当用户调用 `/test-neptune` 时执行。

## 行为
对 Neptune AI 后端执行全量回归测试，验证所有 API 端点和核心业务流程。

## 执行流程
1. 运行 `scripts/setup.sh` — 自动启动基础设施和后端
2. 按顺序执行 `test_cases/*.sh` 中所有测试用例
3. 运行 `scripts/teardown.sh` — 清理环境
4. 输出汇总报告到 `./test_logs/{timestamp}/_summary.log`

## 关键规则
- 所有测试通过 curl 发送 HTTP 请求
- 每个用例独立一个日志文件，存放在 `./test_logs/{timestamp}/`
- 数据隔离：每次测试前清理数据库，用例间通过 save_var/load_var 传递数据
- Mock Agent 和真实 Agent 引擎双重测试（012-mock / 013-real）
- 真实 Agent 测试默认跳过，设置 ENABLE_REAL_AGENT=1 启用
- 单用例超时 60s，连续 3 个失败触发 fail-fast
- curl 默认 connect-timeout 10s，max-time 30s

## 环境变量
- `BASE_URL`: 后端地址，默认 `http://localhost:3000`
- `ENABLE_REAL_AGENT=1`: 启用真实 Agent 引擎测试（013）
- `CASE_TIMEOUT`: 单用例超时秒数，默认 60

## 新增用例
在 `test_cases/` 目录下新增 `.sh` 文件，文件名以编号开头（如 `016-xxx.sh`），遵循 `lib.sh` 提供的函数接口：
- `init_test_log()` — 初始化日志
- `curl_get/post/put/patch/delete` — 发送请求
- `curl_sse` — SSE 流式请求
- `assert_*` 系列函数 — 断言结果
- `save_var/load_var` — 用例间传递数据
- `finish_test` — 结束用例

## 参考
- `reference/architecture.md` — 系统架构文档
- `scripts/lib.sh` — 公共函数库 API
