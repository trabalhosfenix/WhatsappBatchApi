const crypto = require('crypto');

class OwnershipService {
  constructor() {
    this.workerNodeId = process.env.WORKER_NODE_ID || process.env.HOSTNAME || 'api-node';
  }

  getWorkerNodes() {
    const configured = (process.env.WORKER_NODE_LIST || '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    if (configured.length > 0) {
      return configured;
    }

    return [this.workerNodeId];
  }

  getSessionKey({ userId, sessionName }) {
    return `${userId}:${sessionName}`;
  }

  score(node, sessionKey) {
    const hash = crypto.createHash('sha256').update(`${node}:${sessionKey}`).digest('hex');
    return BigInt(`0x${hash}`);
  }

  resolveOwner(input) {
    const sessionKey = typeof input === 'string' ? input : this.getSessionKey(input);
    const nodes = this.getWorkerNodes();

    let winner = nodes[0];
    let maxScore = this.score(winner, sessionKey);

    for (let i = 1; i < nodes.length; i += 1) {
      const node = nodes[i];
      const nodeScore = this.score(node, sessionKey);
      if (nodeScore > maxScore) {
        maxScore = nodeScore;
        winner = node;
      }
    }

    return winner;
  }

  getQueueNameForOwner(ownerNode) {
    return `whatsapp.commands.${ownerNode}`;
  }
}

module.exports = new OwnershipService();
