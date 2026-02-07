const { createClient } = require('redis');

class InstanceMetricsService {
  constructor() {
    this.redisUrl = process.env.REDIS_URL;
    this.client = null;
    this.connectPromise = null;
    this.memory = new Map();
  }

  async getClient() {
    if (!this.redisUrl) return null;
    if (this.client?.isOpen) return this.client;

    if (!this.client) {
      this.client = createClient({ url: this.redisUrl });
      this.client.on('error', () => {});
    }

    if (!this.client.isOpen) {
      if (!this.connectPromise) {
        this.connectPromise = this.client.connect().finally(() => {
          this.connectPromise = null;
        });
      }
      await this.connectPromise;
    }

    return this.client;
  }

  key(instanceId) {
    return `wa:metrics:${instanceId}`;
  }

  async setConnectStart(instanceId, timestampMs) {
    const client = await this.getClient();
    if (client) {
      await client.hSet(this.key(instanceId), 'last_connect_started_at_ms', String(timestampMs));
      return;
    }

    const current = this.memory.get(instanceId) || {};
    current.last_connect_started_at_ms = timestampMs;
    this.memory.set(instanceId, current);
  }

  async increment(instanceId, field, amount = 1) {
    const client = await this.getClient();
    if (client) {
      await client.hIncrBy(this.key(instanceId), field, amount);
      return;
    }

    const current = this.memory.get(instanceId) || {};
    current[field] = Number(current[field] || 0) + amount;
    this.memory.set(instanceId, current);
  }

  async getSnapshot(instanceId) {
    const client = await this.getClient();
    let data;

    if (client) {
      data = await client.hGetAll(this.key(instanceId));
    } else {
      data = this.memory.get(instanceId) || {};
    }

    const connectCount = Number(data.connect_count || 0);
    const totalConnectTimeMs = Number(data.total_connect_time_ms || 0);

    return {
      connect_time_ms_avg: connectCount > 0 ? Math.round(totalConnectTimeMs / connectCount) : 0,
      reconnect_rate: Number(data.reconnect_count || 0),
      auth_401_rate: Number(data.auth_401_count || 0),
      qr_refresh_rate: Number(data.qr_refresh_count || 0),
      connect_count: connectCount,
      total_connect_time_ms: totalConnectTimeMs,
      last_connect_started_at_ms: Number(data.last_connect_started_at_ms || 0)
    };
  }
}

module.exports = new InstanceMetricsService();
