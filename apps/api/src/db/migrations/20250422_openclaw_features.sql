-- Nexus OS OpenClaw-Inspired Features Migration
-- Run this in your Supabase SQL editor

-- ═══════════════════════════════════════════════════════════════
-- CHANNEL SYSTEM
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS channel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('slack', 'discord', 'telegram', 'email', 'whatsapp', 'sms', 'webchat', 'matrix', 'signal')),
    name TEXT NOT NULL,
    workspace_id UUID,
    credentials JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{"autoReply": false, "dmPolicy": "pairing", "allowFrom": []}',
    status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'connecting')),
    is_active BOOLEAN DEFAULT true,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channel_configs(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    thread_id TEXT,
    reply_to UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_approved_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channel_configs(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    approved_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(channel_id, sender_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_created ON channel_messages(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- SUB-AGENT SYSTEM
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subagent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config JSONB NOT NULL,
    status TEXT DEFAULT 'spawning' CHECK (status IN ('spawning', 'running', 'paused', 'completed', 'failed', 'orphaned')),
    parent_session_id UUID REFERENCES subagent_sessions(id) ON DELETE SET NULL,
    child_session_ids UUID[] DEFAULT '{}',
    context JSONB NOT NULL DEFAULT '{"messages": [], "toolResults": [], "variables": {}}',
    output TEXT,
    error TEXT,
    spawned_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subagent_parent ON subagent_sessions(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_subagent_status ON subagent_sessions(status);

-- ═══════════════════════════════════════════════════════════════
-- SKILLS SYSTEM
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS installed_skills (
    id TEXT PRIMARY KEY,
    manifest JSONB NOT NULL,
    config JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    installed_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_skills_status ON installed_skills(status);

-- ═══════════════════════════════════════════════════════════════
-- SEMANTIC MEMORY SYSTEM
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS semantic_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('conversation', 'fact', 'task', 'preference', 'document', 'code', 'event')),
    content TEXT NOT NULL,
    embedding vector(768),  -- Using text-embedding-3-small dimensions
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    related_memory_ids UUID[] DEFAULT '{}'
);

-- Create vector similarity index
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON semantic_memories 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_memories_type ON semantic_memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_created ON semantic_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_metadata ON semantic_memories USING GIN (metadata);

-- Create RPC function for similarity search
CREATE OR REPLACE FUNCTION search_memories(
    query_embedding vector(768),
    match_threshold FLOAT,
    match_count INT,
    filter_type TEXT DEFAULT NULL,
    filter_workspace_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.type,
        m.content,
        m.metadata,
        1 - (m.embedding <=> query_embedding) AS similarity
    FROM semantic_memories m
    WHERE 
        m.embedding IS NOT NULL
        AND (1 - (m.embedding <=> query_embedding)) > match_threshold
        AND (filter_type IS NULL OR m.type = filter_type)
        AND (filter_workspace_id IS NULL OR m.metadata->>'workspaceId' = filter_workspace_id)
        AND (m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- CRON/TASK SCHEDULING SYSTEM
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('mission', 'workflow', 'agent_request', 'skill_execution', 'notification', 'cleanup')),
    schedule JSONB NOT NULL,  -- {cron, interval, runOnce, startAt, endAt, timezone}
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    max_runs INTEGER,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    workspace_id UUID,
    owner_id UUID,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS task_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    output TEXT,
    error TEXT,
    logs TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON scheduled_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_next_run ON scheduled_tasks(next_run_at);
CREATE INDEX IF NOT EXISTS idx_executions_task ON task_executions(task_id);

-- ═══════════════════════════════════════════════════════════════
-- MCP (Model Context Protocol) SYSTEM
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('stdio', 'sse', 'streamable-http')),
    command TEXT,
    args TEXT[] DEFAULT '{}',
    url TEXT,
    env JSONB DEFAULT '{}',
    cwd TEXT,
    timeout INTEGER DEFAULT 30000,
    capabilities JSONB DEFAULT '{"tools": true}',
    auth JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- CREATE MEMORY TABLES HELPER FUNCTION
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_memory_tables_if_not_exists()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- This function is called by the application to ensure tables exist
    -- Tables are already created above, so this is a no-op placeholder
    -- for future dynamic table creation needs
    NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- CANVAS / LIVE DOCUMENT SYSTEM
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS canvas_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('whiteboard', 'code', 'markdown', 'diagram', 'spreadsheet', 'mixed')),
    content JSONB NOT NULL DEFAULT '[]',
    participants UUID[] DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS canvas_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES canvas_documents(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('insert', 'update', 'delete', 'move', 'resize', 'style')),
    block_id UUID,
    data JSONB NOT NULL DEFAULT '{}',
    author UUID,
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canvas_documents_created ON canvas_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvas_operations_doc ON canvas_operations(document_id);

-- ═══════════════════════════════════════════════════════════════
-- VOICE / AUDIO PIPELINE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (status IN ('idle', 'listening', 'processing', 'speaking', 'error')),
    mode TEXT NOT NULL CHECK (mode IN ('push-to-talk', 'continuous', 'wake-word')),
    wake_word TEXT,
    language TEXT DEFAULT 'en',
    model TEXT DEFAULT 'whisper-1',
    tts_voice TEXT DEFAULT 'alloy',
    tts_provider TEXT DEFAULT 'openai',
    auto_reply BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_activity_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS voice_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES voice_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('audio_in', 'transcript', 'ai_response', 'audio_out')),
    data JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT now(),
    duration INTEGER
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON voice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_chunks_session ON voice_chunks(session_id);

-- ═══════════════════════════════════════════════════════════════
-- DAEMON MONITORING
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daemon_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pid INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'restarting', 'stopped', 'error')),
    uptime_seconds INTEGER,
    memory_rss_mb FLOAT,
    memory_heap_mb FLOAT,
    cpu_user_ms FLOAT,
    cpu_system_ms FLOAT,
    active_connections INTEGER DEFAULT 0,
    queued_tasks INTEGER DEFAULT 0,
    restart_count INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daemon_status_timestamp ON daemon_status_history(timestamp DESC);

-- ═══════════════════════════════════════════════════════════════
-- DOCKER SANDBOX INSTANCES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sandbox_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image TEXT NOT NULL,
    container_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('creating', 'running', 'paused', 'stopped', 'error')),
    config JSONB NOT NULL DEFAULT '{}',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    logs JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_status ON sandbox_instances(status);
