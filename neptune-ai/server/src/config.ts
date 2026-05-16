/**
 * 环境变量配置
 */
export const config = {
    // 数据库配置
    database: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/neptune_ai',
    },

    // Redis 配置
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6380',
    },

    // JWT 配置
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    // LLM API 配置（支持 Anthropic/GLM 等兼容 API）
    llm: {
        apiKey: process.env.NEPTUNE_LLM_API_KEY || '',
        baseURL: process.env.NEPTUNE_LLM_BASE_URL || '',
        model: process.env.NEPTUNE_LLM_MODEL || '',
    },

    // 服务配置
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || '0.0.0.0',
    },

    // 日志配置
    log: {
        level: process.env.LOG_LEVEL || 'info',
    },
} as const;

// 验证必需的环境变量
export function validateConfig() {
    const errors: string[] = [];

    if (!process.env.DATABASE_URL && config.database.url.includes('localhost')) {
        errors.push('DATABASE_URL 环境变量未设置（生产环境不能使用 localhost）');
    }

    if (!process.env.JWT_SECRET || config.jwt.secret === 'your-secret-key-change-in-production') {
        errors.push('JWT_SECRET 环境变量未设置或使用默认值（生产环境必须更改）');
    }

    if (errors.length > 0) {
        throw new Error(`配置验证失败:\n${errors.join('\n')}`);
    }
}
