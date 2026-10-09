import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

class MemoryRedisMock {
  private store = new Map<string, string>();
  private ttls = new Map<string, NodeJS.Timeout>();
  private sets = new Map<string, Set<string>>();
  private sortedSets = new Map<string, Map<string, number>>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    this.store.set(key, value);
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key)!);
      this.ttls.delete(key);
    }
    if (mode === 'EX' && duration) {
      const timer = setTimeout(() => {
        this.store.delete(key);
        this.ttls.delete(key);
      }, duration * 1000);
      this.ttls.set(key, timer);
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key)!);
      this.ttls.delete(key);
    }
    this.sets.delete(key);
    this.sortedSets.delete(key);
    return existed ? 1 : 0;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed++;
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    const zset = this.sortedSets.get(key)!;
    const isNew = !zset.has(member);
    zset.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrevrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]> {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];
    const sorted = Array.from(zset.entries()).sort((a, b) => b[1] - a[1]);
    const sliced = stop === -1 ? sorted.slice(start) : sorted.slice(start, stop + 1);
    if (withScores === 'WITHSCORES') {
      const res: string[] = [];
      sliced.forEach(([member, score]) => {
        res.push(member, String(score));
      });
      return res;
    }
    return sliced.map(([member]) => member);
  }

  async zrank(key: string, member: string): Promise<number | null> {
    const zset = this.sortedSets.get(key);
    if (!zset || !zset.has(member)) return null;
    const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const idx = sorted.findIndex(([m]) => m === member);
    return idx === -1 ? null : idx;
  }

  async zrevrank(key: string, member: string): Promise<number | null> {
    const zset = this.sortedSets.get(key);
    if (!zset || !zset.has(member)) return null;
    const sorted = Array.from(zset.entries()).sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([m]) => m === member);
    return idx === -1 ? null : idx;
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  duplicate() {
    return new MemoryRedisMock();
  }
}

let redisClient: any;
let pubClient: any;
let subClient: any;
let isRedisAvailable = false;

if (process.env.NODE_ENV === 'test' || !process.env.REDIS_URL) {
  redisClient = new MemoryRedisMock();
  pubClient = new MemoryRedisMock();
  subClient = new MemoryRedisMock();
} else {
  try {
    const primaryClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 2) return null;
        return 100;
      },
      enableReadyCheck: false,
      lazyConnect: true
    });

    primaryClient.on('connect', () => {
      isRedisAvailable = true;
      console.log(`[REDIS] Successfully connected to Redis instance at ${REDIS_URL}`);
    });

    primaryClient.on('error', () => {
      if (!isRedisAvailable) {
        redisClient = new MemoryRedisMock();
        pubClient = new MemoryRedisMock();
        subClient = new MemoryRedisMock();
      }
    });

    primaryClient.connect().then(() => {
      isRedisAvailable = true;
    }).catch(() => {
      redisClient = new MemoryRedisMock();
      pubClient = new MemoryRedisMock();
      subClient = new MemoryRedisMock();
    });

    redisClient = primaryClient;
    pubClient = primaryClient.duplicate();
    subClient = primaryClient.duplicate();
  } catch (e) {
    redisClient = new MemoryRedisMock();
    pubClient = new MemoryRedisMock();
    subClient = new MemoryRedisMock();
  }
}

export { redisClient, pubClient, subClient, isRedisAvailable, MemoryRedisMock };
