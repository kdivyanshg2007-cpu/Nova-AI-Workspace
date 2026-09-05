CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS workspaces (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token TEXT NOT NULL,

    expires_at TIMESTAMP NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    workspace_id INTEGER
        REFERENCES workspaces(id)
        ON DELETE SET NULL,

    title VARCHAR(200),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    workspace_id INTEGER
        REFERENCES workspaces(id)
        ON DELETE SET NULL,

    filename VARCHAR(255) NOT NULL,

    file_path TEXT NOT NULL,

    mime_type VARCHAR(100),

    file_size BIGINT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,

    conversation_id INTEGER NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,

    content TEXT NOT NULL,

    file_id INTEGER
        REFERENCES files(id)
        ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS memories (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    workspace_id INTEGER
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    memory_key VARCHAR(100) NOT NULL,

    memory_value TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- DAY 34 — NOTES
-- =========================================================

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    workspace_id INTEGER
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,

    content TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- DAY 34 — TASKS
-- =========================================================

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    workspace_id INTEGER
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    priority VARCHAR(20) DEFAULT 'medium',

    status VARCHAR(20) DEFAULT 'pending',

    deadline TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- DAY 38 — USER PREFERENCES
-- =========================================================

CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    language VARCHAR(20) NOT NULL DEFAULT 'en',

    theme VARCHAR(20) NOT NULL DEFAULT 'light',

    model_preference VARCHAR(50) NOT NULL DEFAULT 'gemini-3.6-flash',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- DAY 39 — AI EVALUATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS ai_evaluations (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    workspace_id INTEGER
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    conversation_id INTEGER
        REFERENCES conversations(id)
        ON DELETE SET NULL,

    message_id INTEGER
        REFERENCES messages(id)
        ON DELETE SET NULL,

    score INTEGER NOT NULL
        CHECK (score >= 1 AND score <= 5),

    feedback TEXT,

    evaluation_type VARCHAR(50) NOT NULL DEFAULT 'quality',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);