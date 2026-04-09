import Redis from 'ioredis'; 

let client: Redis | null = null; 

export function getRedis(): Redis | null { 
  if (!process.env.REDIS_URL) return null; 
  if (!client) { 
    client = new Redis(process.env.REDIS_URL, { 
      maxRetriesPerRequest: 1, 
      enableReadyCheck: false, 
      lazyConnect: true, 
    }); 
    client.on('error', (e) => console.warn('[Redis] Connection error:', e.message)); 
  } 
  return client; 
} 
