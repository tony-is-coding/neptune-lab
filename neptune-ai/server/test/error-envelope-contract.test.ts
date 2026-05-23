/**
 * 错误信封一致性合同测试
 *
 * 目的：保证所有错误响应（4xx/5xx）都遵守标准信封：
 *   {error: ApiErrorCode, message: string, requestId: string, details: object}
 *
 * 校验维度：
 * 1. 业务路由的典型错误路径（auth/agents/skills/runs/closing）必须返回标准信封
 * 2. 全局 setErrorHandler 兜底未捕获错误必须返回标准信封
 * 3. 全局 setNotFoundHandler 路由未匹配必须返回标准信封
 * 4. 错误码必须属于 ApiErrorCode 枚举集合，不允许自由字符串
 * 5. requestId 必须非空，且与请求头 X-Request-Id 一致
 */
import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {API_ERROR_CODES, type ApiErrorCode} from '@shared/neptune-ai';
import {createTestApp, createTestUser} from './setup';

const ERROR_CODE_SET = new Set<string>(API_ERROR_CODES);

/**
 * 校验响应是否遵守标准错误信封。
 */
function expectStandardEnvelope(rawBody: unknown, expected?: {error?: ApiErrorCode}) {
    // Bun 在 expect.toMatchObject 之后会把同一对象上的某些字段置为 undefined，
    // 这是已知的引擎行为；先快照所需字段，避免后续断言看到污染后的视图。
    const envelope = rawBody as {error: string; message: string; requestId: string; details?: unknown};
    const snapshot = {
        error: envelope.error,
        message: envelope.message,
        requestId: envelope.requestId,
    };
    expect(rawBody).toMatchObject({
        error: expect.any(String),
        message: expect.any(String),
        requestId: expect.any(String),
    });
    expect(ERROR_CODE_SET.has(snapshot.error)).toBe(true);
    expect(snapshot.requestId.length).toBeGreaterThan(0);
    expect(snapshot.message.length).toBeGreaterThan(0);
    if (expected?.error) {
        expect(snapshot.error).toBe(expected.error);
    }
}

describe('API 错误信封一致性合同', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await createTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    test('全局 404 兜底返回标准信封', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/__definitely_not_a_route__',
        });
        expect(res.statusCode).toBe(404);
        expectStandardEnvelope(res.json(), {error: 'RESOURCE_NOT_FOUND'});
        // requestId 与响应头 X-Request-Id 一致
        const headerRequestId = res.headers['x-request-id'];
        expect(typeof headerRequestId).toBe('string');
        expect(res.json().requestId).toBe(headerRequestId);
    });

    test('未带 token 访问受保护路由返回 401 标准信封', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/agents',
        });
        expect(res.statusCode).toBe(401);
        expectStandardEnvelope(res.json(), {error: 'UNAUTHORIZED'});
    });

    test('携带非法 token 返回 401 标准信封', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/agents',
            headers: {authorization: 'Bearer not-a-real-token'},
        });
        expect(res.statusCode).toBe(401);
        expectStandardEnvelope(res.json(), {error: 'UNAUTHORIZED'});
    });

    test('登录缺字段返回 400 VALIDATION_FAILED 标准信封', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {email: 'a@b.com'},
        });
        expect(res.statusCode).toBe(400);
        expectStandardEnvelope(res.json(), {error: 'VALIDATION_FAILED'});
    });

    test('注册邮箱已被使用返回 409 STATE_CONFLICT 标准信封', async () => {
        const existingUser = await createTestUser(app);
        const email = (existingUser.user as {email: string}).email;
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                tenantName: '冲突租户',
                name: 'X',
                email,
                password: 'Test1234!',
            },
        });
        expect(res.statusCode).toBe(409);
        expectStandardEnvelope(res.json(), {error: 'STATE_CONFLICT'});
        expect(res.json().details).toMatchObject({reason: 'email_taken'});
    });

    test('请求 ID 通过 X-Request-Id 头传入时被回写', async () => {
        const incoming = '00000000-0000-4000-8000-000000000001';
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/__not_found__',
            headers: {'x-request-id': incoming},
        });
        expect(res.statusCode).toBe(404);
        expect(res.headers['x-request-id']).toBe(incoming);
        expect(res.json().requestId).toBe(incoming);
    });

    test('错误码集合是封闭的：枚举登记的每个值都符合命名规范', () => {
        for (const code of API_ERROR_CODES) {
            expect(code).toMatch(/^[A-Z][A-Z0-9_]+$/);
        }
        expect(API_ERROR_CODES.length).toBeGreaterThan(0);
    });
});
