const { createClient } = require('redis');
const crypto = require('crypto');

class DistributedLockService {
  constructor() {
    this.redisUrl = process.env.REDIS_URL;
    this.client = null;
    this.connectPromise = null;
  }

  isEnabled() {
    return Boolean(this.redisUrl);
  }

  async getClient() {
    if (!this.isEnabled()) return null;

    if (this.client?.isOpen) return this.client;

    if (!this.client) {
      this.client = createClient({ url: this.redisUrl });
      this.client.on('error', (error) => {
        console.warn(`⚠️ [DistributedLock] Redis error: ${error.message}`);
      });
    }

    if (!this.client.isOpen) {
      if (!this.connectPromise) {
        this.connectPromise = this.client.connect()
          .catch((error) => {
            this.client = null;
            throw error;
          })
          .finally(() => {
            this.connectPromise = null;
          });
      }
      await this.connectPromise;
    }

    return this.client;
  }

  async acquire(key, ttlMs = 15000) {
    const client = await this.getClient();

    if (!client) {
      return { acquired: true, token: 'in-memory-fallback', fallback: true };
    }

    const token = crypto.randomUUID();
    const result = await client.set(key, token, { NX: true, PX: ttlMs });

    return {
      acquired: result === 'OK',
      token,
      fallback: false
    };
  }

  async release(key, token) {
    const client = await this.getClient();

    if (!client || token === 'in-memory-fallback') {
      return true;
    }

    const script = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;

    const result = await client.eval(script, {
      keys: [key],
      arguments: [token]
    });

    return result === 1;
  }
}

module.exports = new DistributedLockService();
