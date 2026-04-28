-- Migration 004: Marketplace Agents
CREATE TABLE IF NOT EXISTS "marketplace_agents" (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    persona      TEXT NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    install_count INTEGER NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Agents
INSERT INTO marketplace_agents (id, name, description, persona, capabilities, install_count)
VALUES 
('gtm-strategist', 'GTM Strategist', 'Go-to-market planning for B2B SaaS in India', 'founder', ARRAY['market sizing', 'channel strategy', 'ICP definition'], 142),
('lead-hunter', 'Lead Hunter', 'Finds and qualifies B2B leads in Indian markets', 'founder', ARRAY['lead research', 'email personalisation', 'LinkedIn prospecting'], 98),
('code-reviewer', 'Code Reviewer', 'Reviews PRs, finds bugs, suggests refactors', 'developer', ARRAY['TypeScript', 'React', 'Node.js', 'security audit'], 215),
('api-architect', 'API Architect', 'Designs REST and GraphQL APIs with full documentation', 'developer', ARRAY['API design', 'OpenAPI spec', 'schema validation'], 87),
('essay-coach', 'Essay Coach', 'Structures and improves academic essays and reports', 'student', ARRAY['argument structure', 'citations', 'grammar'], 174),
('exam-prep', 'Exam Prep', 'Creates revision plans, flashcards and mock questions', 'student', ARRAY['flashcards', 'practice questions', 'study schedule'], 63)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    persona = EXCLUDED.persona,
    capabilities = EXCLUDED.capabilities,
    install_count = EXCLUDED.install_count;
