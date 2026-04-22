"""
Nexus OS Cognitive Memory

Local-first memory layer leveraging SQLite with vector capabilities.
Implements custom cosine similarity to allow RAG (Retrieval-Augmented Generation) 
without needing heavy vector database servers.
Includes a background indexer capable of traversing project directories.
"""

import sqlite3
import json
import math
import datetime
import os
from typing import List, Dict, Any, Tuple

# Strictly enforce real SentenceTransformer embeddings for biological intelligence weighting
from sentence_transformers import SentenceTransformer
embedder = SentenceTransformer('all-MiniLM-L6-v2')

DB_PATH = "nexus_cognitive_memory.db"

def get_embedding(text: str) -> List[float]:
    """Return genuine AI 384-d semantic memory mappings."""
    return embedder.encode(text).tolist()

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a * a for a in v1))
    mag2 = math.sqrt(sum(b * b for b in v2))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot_product / (mag1 * mag2)

class CognitiveMemory:
    def __init__(self, db_path=DB_PATH):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()
        self.initialize_db()

    def initialize_db(self):
        """Create a nexus_memory table with vector and metadata columns."""
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS nexus_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT,
                embedding BLOB,
                metadata TEXT,
                timestamp TEXT,
                importance_score FLOAT DEFAULT 1.0
            )
        ''')
        try:
            self.cursor.execute('ALTER TABLE nexus_memory ADD COLUMN importance_score FLOAT DEFAULT 1.0')
        except sqlite3.OperationalError:
            pass
        self.conn.commit()

    def store_memory(self, text: str, metadata: Dict[str, Any] = None):
        """Convert a string into a vector embedding and store it in DB."""
        if metadata is None:
            metadata = {}
        
        vector = get_embedding(text)
        blob = json.dumps(vector).encode('utf-8')
        timestamp = datetime.datetime.now().isoformat()
        
        self.cursor.execute('''
            INSERT INTO nexus_memory (content, embedding, metadata, timestamp)
            VALUES (?, ?, ?, ?)
        ''', (text, blob, json.dumps(metadata), timestamp))
        self.conn.commit()
    
    def query_memory(self, query_text: str, limit: int = 5) -> str:
        """Perform a Cosine Similarity Search to find nearest context chunks using Biologically Inspired Weighting."""
        query_vector = get_embedding(query_text)
        self.cursor.execute('SELECT id, content, embedding, metadata, timestamp, importance_score FROM nexus_memory')
        rows = self.cursor.fetchall()
        
        scored_memories = []
        for row in rows:
            mem_id, content, blob, metadata_str, timestamp, importance_score = row
            memory_vector = json.loads(blob.decode('utf-8'))
            similarity = cosine_similarity(query_vector, memory_vector)
            
            # Biological Weighting: Boost similarity by importance_score
            # e.g., an importance of 2.0 adds a 10% boost.
            weighted_score = similarity * (1.0 + (math.log(max(1.0, importance_score)) * 0.1))
            
            # Additional context injection
            metadata = json.loads(metadata_str) if metadata_str else {}
            scored_memories.append((weighted_score, content, metadata, timestamp, mem_id))
        
        # Sort by highest score
        scored_memories.sort(key=lambda x: x[0], reverse=True)
        # Assuming minimal relevance threshold of 0.1 for pseudo-vectors
        top_results = [(m[1], m[2], m[3], m[4]) for m in scored_memories[:limit] if m[0] > 0.05]
        
        if not top_results:
            return "No relevant historical memory."
        
        formatted_results = []
        for idx, (content, meta, ts, mem_id) in enumerate(top_results):
            source = meta.get('file', 'Unknown Source')
            formatted_results.append(f"[{idx+1}] ID: {mem_id} | DATE: {ts} | SOURCE: {source}\n{content}")
            
        return "\\n---\\n".join(formatted_results)

    def increment_importance(self, memory_id: int, increment: float = 1.0):
        """Boosts the importance score of a memory based on user confirmation."""
        self.cursor.execute('''
            UPDATE nexus_memory 
            SET importance_score = importance_score + ? 
            WHERE id = ?
        ''', (increment, memory_id))
        self.conn.commit()

    def evict_memories(self, max_capacity: int = 1000):
        """Evicts memories prioritizing the lowest importance score, then oldest timestamp."""
        self.cursor.execute('SELECT COUNT(*) FROM nexus_memory')
        count = self.cursor.fetchone()[0]
        
        if count > max_capacity:
            excess = count - max_capacity
            self.cursor.execute('''
                DELETE FROM nexus_memory 
                WHERE id IN (
                    SELECT id FROM nexus_memory 
                    ORDER BY importance_score ASC, timestamp ASC 
                    LIMIT ?
                )
            ''', (excess,))
            self.conn.commit()
            return f"Evicted {excess} stale memories."
        return "No eviction needed."

    def get_recent_memories(self, limit: int = 10) -> List[Tuple[str, str, Dict[str, Any]]]:
        """Fetch the most recently stored memory chunks."""
        self.cursor.execute('SELECT timestamp, content, metadata FROM nexus_memory ORDER BY timestamp DESC LIMIT ?', (limit,))
        rows = self.cursor.fetchall()
        return [(r[0], r[1], json.loads(r[2]) if r[2] else {}) for r in rows]

    def wipe_memory(self):
        """Wipe the local vector database entirely."""
        self.cursor.execute('DELETE FROM nexus_memory')
        self.conn.commit()
        return "Local vector DB wiped completely."

# Global singleton
local_memory = CognitiveMemory()

def index_folder(path: str) -> str:
    """Recursively parses all code files in a given directory, chunks them, and stores embeddings."""
    valid_extensions = {'.txt', '.md', '.py', '.js', '.ts', '.tsx', '.json', '.sh'}
    ignored_dirs = {'node_modules', '.venv', 'venv', '.git', 'dist', 'build', '.next'}
    
    if not os.path.isdir(path):
        return f"Error: Path '{path}' is not a valid directory."
        
    local_memory.store_memory(f"User requested Full System Index for {path}", {"action": "index_started"})
    
    count = 0
    for root, dirs, files in os.walk(path):
        # Mutating dirs in-place to ignore specified directories
        dirs[:] = [d for d in dirs if d not in ignored_dirs]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in valid_extensions:
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    # Basic sliding window chunking to ensure context overlap
                    chunk_size = 1500
                    overlap = 200
                    
                    if len(content) == 0:
                        continue
                        
                    start = 0
                    while start < len(content):
                        end = min(start + chunk_size, len(content))
                        chunk = content[start:end]
                        local_memory.store_memory(chunk, {
                            "file": filepath,
                            "type": "code_snippet",
                            "chunk_start": start
                        })
                        count += 1
                        start += (chunk_size - overlap)
                        
                except Exception as e:
                    print(f"Skipping {filepath} due to read error: {e}")
                    
    return f"Sovereign Mind Indexing complete. Processed {count} chunks into memory."
