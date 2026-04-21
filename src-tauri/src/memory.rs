use rusqlite::{ffi::sqlite3_auto_extension, Connection, Result, params};
use sqlite_vec::sqlite3_vec_init;
use zerocopy::AsBytes;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub struct MemoryManager {
    db_path: PathBuf,
}

impl MemoryManager {
    pub fn new(app: &AppHandle) -> Self {
        let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("./data"));
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("nexus_memory.db");

        // Register sqlite-vec as an auto-extension
        unsafe {
            let _ = sqlite3_auto_extension(Some(std::mem::transmute(sqlite3_vec_init as *const ())));
        }

        let manager = Self { db_path };
        manager.init_db().expect("Failed to initialize memory database");
        manager.init_knowledge_graph().expect("Failed to init Knowledge Graph");
        manager
    }

    fn init_db(&self) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;

        // 1. Session History Table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                role TEXT,
                content TEXT
            )",
            [],
        )?;

        // 2. Semantic Knowledge Table (Vector Search)
        // Note: float[384] is common for all-MiniLM-L6-v2 embeddings
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
                embedding float[384]
            )",
            [],
        )?;

        // Metadata table linked to vectors
        conn.execute(
            "CREATE TABLE IF NOT EXISTS knowledge_metadata (
                id INTEGER PRIMARY KEY,
                content TEXT,
                source TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        Ok(())
    }

    pub fn save_interaction(&self, role: &str, content: &str) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        conn.execute(
            "INSERT INTO sessions (role, content) VALUES (?, ?)",
            params![role, content],
        )?;
        Ok(())
    }

    pub fn add_knowledge(&self, content: &str, source: &str, embedding: Vec<f32>) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        
        // Insert metadata first to get an ID
        conn.execute(
            "INSERT INTO knowledge_metadata (content, source) VALUES (?, ?)",
            params![content, source],
        )?;
        let rowid = conn.last_insert_rowid();

        // Insert vector with matching rowid
        conn.execute(
            "INSERT INTO knowledge_vec(rowid, embedding) VALUES (?, ?)",
            params![rowid, embedding.as_bytes()],
        )?;

        Ok(())
    }

    pub fn search_memory(&self, query_embedding: Vec<f32>, limit: usize) -> Result<Vec<(String, f32)>> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            "SELECT m.content, v.distance 
             FROM knowledge_vec v
             JOIN knowledge_metadata m ON v.rowid = m.id
             WHERE embedding MATCH ? 
             ORDER BY distance 
             LIMIT ?"
        )?;

        let rows = stmt.query_map(params![query_embedding.as_bytes(), limit], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    // --- Pillar 3: Cognitive Depth (Temporal Knowledge Graph) ---

    pub fn init_knowledge_graph(&self) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;

        // 1. Nodes (Entities)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS graph_nodes (
                id INTEGER PRIMARY KEY,
                label TEXT NOT NULL,
                node_type TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // 2. Edges (Relationships)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS graph_edges (
                id INTEGER PRIMARY KEY,
                source_node_id INTEGER,
                target_node_id INTEGER,
                predicate TEXT NOT NULL,
                weight FLOAT DEFAULT 1.0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(source_node_id) REFERENCES graph_nodes(id),
                FOREIGN KEY(target_node_id) REFERENCES graph_nodes(id)
            )",
            [],
        )?;

        // 3. Semantic Search over nodes/edges
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS graph_vec USING vec0(
                embedding float[384]
            )",
            [],
        )?;

        Ok(())
    }

    /// Inserts a new relationship into the Temporal Knowledge Graph.
    pub fn add_triple(&self, subject: &str, predicate: &str, _object: &str, _timestamp: Option<String>) -> Result<()> {
        // Implementation for Phase 4 bootstrap. Real logic would insert/find node IDs first.
        let conn = Connection::open(&self.db_path)?;

        // Mocking node IDs
        let source_id = 1;
        let target_id = 2;

        conn.execute(
            "INSERT INTO graph_edges (source_node_id, target_node_id, predicate) VALUES (?, ?, ?)",
            params![source_id, target_id, predicate],
        )?;

        Ok(())
    }

    /// Executes a multi-hop traversal given semantic entry points.
    pub fn multi_hop_query(&self, _entry_query: &str, _hops: usize) -> Result<Vec<String>> {
        // Implementation for Phase 4 bootstrap.
        // Would normally: 1. Vector search for entry nodes. 2. SQL JOIN traversal.
        Ok(vec![
            "Found: Project Alpha -> depends_on -> File B".to_string(),
            "Found: Alice -> modified -> File B".to_string()
        ])
    }
}
