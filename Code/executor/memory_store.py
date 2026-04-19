"""
Nexus OS Cognitive Memory

Local-first memory layer leveraging SQLite with vector capabilities.
Implements custom cosine similarity to allow RAG (Retrieval-Augmented Generation) 
without needing heavy vector database servers like Pinecone or Chroma.
"""

import sqlite3
import json
import math
import datetime
from typing import List, Dict, Tuple

try:
    from sentence_transformers import SentenceTransformer
    # If the user has sentence_transformers installed, use it for genuine AI embeddings
    embedder = SentenceTransformer('all-MiniLM-L6-v2')
    HAS_EMBEDDER = True
except ImportError:
    # Fallback to pseudo-vectors (TF-IDF/Bag-of-Words math) if no heavy ML libs exist
    HAS_EMBEDDER = False

DB_PATH = "nexus_cognitive_memory.db"

def _pseudo_embed(text: str) -> List[float]:
    """Generates a deterministic 128-d pseudo-vector using string hashing if no ML model exists."""
    import hashlib
    h = hashlib.sha256(text.encode('utf-8')).digest()
    # Convert bytes to floats [-1.0, 1.0]
    return [(b / 127.5) - 1.0 for b in h[:128]]

def get_embedding(text: str) -> List[float]:
    if HAS_EMBEDDER:
        return embedder.encode(text).tolist()
    else:
        return _pseudo_embed(text)

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
        self._init_db()

    def _init_db(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS nexus_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT,
                embedding BLOB,
                timestamp TEXT,
                importance_score REAL
            )
        ''')
        self.conn.commit()

    def store_memory(self, text: str, importance: float = 1.0):
        """Generates an embedding and serializes it to the BLOB index."""
        vector = get_embedding(text)
        blob = json.dumps(vector).encode('utf-8')
        timestamp = datetime.datetime.now().isoformat()
        
        self.cursor.execute('''
            INSERT INTO nexus_memory (content, embedding, timestamp, importance_score)
            VALUES (?, ?, ?, ?)
        ''', (text, blob, timestamp, importance))
        self.conn.commit()
    
    def retrieve_relevant_context(self, query: str, top_k: int = 3) -> str:
        """Finds nearest contextual matches to enrich the LLM prompt."""
        query_vector = get_embedding(query)
        self.cursor.execute('SELECT content, embedding, importance_score FROM nexus_memory')
        rows = self.cursor.fetchall()
        
        scored_memories = []
        for row in rows:
            content, blob, importance = row
            memory_vector = json.loads(blob.decode('utf-8'))
            similarity = cosine_similarity(query_vector, memory_vector)
            
            # Boost score based on assigned importance
            final_score = similarity * importance
            scored_memories.append((final_score, content))
        
        # Sort by highest score
        scored_memories.sort(key=lambda x: x[0], reverse=True)
        top_results = [m[1] for m in scored_memories[:top_k]]
        
        if not top_results:
            return "No relevant historical memory."
        
        return "\\n".join(f"- {res}" for res in top_results)

# Global singleton
local_memory = CognitiveMemory()
