import Redis from 'ioredis'; 

let client: Redis | null = null; 

export function getRedis(): Redis | null { 
  if (!process.env.REDIS_URL) return null; 
  if (!client) { 
    client = new Redis(process.env.REDIS_URL, { 
      maxRetriesPerRequest: 3, 
      enableReadyCheck: false, 
      connectTimeout: 10000,
      lazyConnect: true, 
      retryStrategy: (times: number) => Math.min(times * 100, 2000),
    }); 
    client.on('error', (e) => console.warn('[Redis] Connection error:', e instanceof Error ? e.message : String(e))); 
    client.on('connect', () => console.log('[Redis] Connecting...')); 
    client.on('ready', () => console.log('[Redis] Ready')); 
    client.on('close', () => console.warn('[Redis] Connection closed')); 
  } 
  return client; 
}
 
