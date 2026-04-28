use rusqlite::{ffi::sqlite3_auto_extension, Connection, Result, params};
use sqlite_vec::sqlite3_vec_init;
use zerocopy::AsBytes;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

use std::sync::Mutex;

pub struct MemoryManager {
    db_path: PathBuf,
    conn: Mutex<Connection>,
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

        let conn = Connection::open(&db_path).expect("Failed to open memory database");
        let manager = Self { db_path, conn: Mutex::new(conn) };
        manager.init_db().expect("Failed to initialize memory database");
        manager
    }

    fn init_db(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

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
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sessions (role, content) VALUES (?, ?)",
            params![role, content],
        )?;
        Ok(())
    }

    pub fn add_knowledge(&self, content: &str, source: &str, embedding: Vec<f32>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
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
        let conn = self.conn.lock().unwrap();
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
}
