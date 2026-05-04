import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * 创建 PostgreSQL 连接
 * 注意：在开发环境中，我们使用单个连接池
 * 在生产环境中，可能需要配置连接池参数
 */
function createDbConnection() {
  const connectionString = process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/neptune_ai';

  const client = postgres(connectionString, {
    max: 10, // 最大连接数
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

/**
 * 数据库实例
 */
export const db = createDbConnection();

/**
 * 导出 schema 以便在其他地方使用
 */
export * from './schema';
