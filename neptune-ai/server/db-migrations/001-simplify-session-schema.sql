-- Migration: 简化 Session Schema
-- Date: 2026-04-30
-- Description:
--   1. sessions 表简化：移除 engineId/tokenUsage/configSnapshot，id 改 text，加 lastActiveAt
--   2. messages 表移除
--   3. billingRecords.sessionId 改 text

-- ============================================
-- 1. sessions 表调整
-- ============================================

-- 添加新的 lastActiveAt 列
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT NOW();

-- 删除不再需要的列
ALTER TABLE sessions DROP COLUMN IF EXISTS engine_id;
ALTER TABLE sessions DROP COLUMN IF EXISTS token_usage;
ALTER TABLE sessions DROP COLUMN IF EXISTS config_snapshot;

-- 将 id 从 UUID 改为 text
-- 注意：由于 PostgreSQL 不直接支持修改主键类型，需要重建表
-- 以下是重建步骤

-- 1. 创建新的 sessions 表
CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  template_id UUID REFERENCES agent_templates(id),
  status TEXT NOT NULL DEFAULT 'created',
  workspace TEXT NOT NULL,
  last_active_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 复制数据（将 UUID 转换为 text）
INSERT INTO sessions_new (id, tenant_id, user_id, template_id, status, workspace, last_active_at, created_at, updated_at)
SELECT
  id::text as id,
  tenant_id,
  user_id,
  template_id,
  status,
  workspace,
  created_at as last_active_at, -- 使用 created_at 作为初始 last_active_at
  created_at,
  updated_at
FROM sessions;

-- 3. 重建索引
CREATE INDEX sessions_new_tenant_status_idx ON sessions_new(tenant_id, status);
CREATE INDEX sessions_new_user_id_idx ON sessions_new(user_id);

-- 4. 删除旧表并重命名新表
DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

-- ============================================
-- 2. messages 表移除
-- ============================================

-- 直接删除 messages 表
DROP TABLE IF EXISTS messages;

-- ============================================
-- 3. billingRecords.sessionId 改 text
-- ============================================

-- 1. 添加新的 text 类型列
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS session_id_new TEXT;

-- 2. 复制数据（将 UUID 转换为 text）
UPDATE billing_records SET session_id_new = session_id::text WHERE session_id IS NOT NULL;

-- 3. 删除旧列并重命名新列
ALTER TABLE billing_records DROP COLUMN session_id;
ALTER TABLE billing_records RENAME COLUMN session_id_new TO session_id;

-- 4. 重建索引
DROP INDEX IF EXISTS billing_records_session_id_idx;
CREATE INDEX billing_records_session_id_idx ON billing_records(session_id);
