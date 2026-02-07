const fs = require('fs');
const path = require('path');

class SessionStorageProvider {
  constructor() {
    this.basePath = process.env.SHARED_SESSIONS_PATH || path.join(__dirname, '..', 'auth_sessions');
  }

  getSessionDir(sessionName) {
    return path.join(this.basePath, sessionName);
  }

  ensureSessionDir(sessionName) {
    const dir = this.getSessionDir(sessionName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  hasSavedSession(sessionName) {
    try {
      const dir = this.getSessionDir(sessionName);
      if (!fs.existsSync(dir)) return false;
      return fs.readdirSync(dir).length > 0;
    } catch (error) {
      console.warn(`⚠️ [SessionStorage] Falha ao verificar sessão ${sessionName}: ${error.message}`);
      return false;
    }
  }

  removeSession(sessionName) {
    const dir = this.getSessionDir(sessionName);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    }
    return false;
  }
}

module.exports = new SessionStorageProvider();
