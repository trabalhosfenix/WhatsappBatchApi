const fs = require('fs');
const path = require('path');

class SessionStorageProvider {
  constructor() {
    this.defaultLocalPath = path.join(__dirname, '..', 'auth_sessions');
    this.basePath = process.env.SHARED_SESSIONS_PATH || this.defaultLocalPath;
  }

  getSessionDir(sessionName) {
    return path.join(this.basePath, sessionName);
  }

  getLegacyLocalSessionDir(sessionName) {
    return path.join(this.defaultLocalPath, sessionName);
  }

  migrateLegacySessionIfNeeded(sessionName) {
    const targetDir = this.getSessionDir(sessionName);
    const legacyDir = this.getLegacyLocalSessionDir(sessionName);

    if (targetDir === legacyDir) {
      return { migrated: false, reason: 'same_path' };
    }

    if (!fs.existsSync(legacyDir) || fs.existsSync(targetDir)) {
      return { migrated: false, reason: 'not_needed' };
    }

    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.renameSync(legacyDir, targetDir);

    return { migrated: true, from: legacyDir, to: targetDir };
  }

  ensureSessionDir(sessionName) {
    this.migrateLegacySessionIfNeeded(sessionName);

    const dir = this.getSessionDir(sessionName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  hasSavedSession(sessionName) {
    try {
      this.migrateLegacySessionIfNeeded(sessionName);

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
    const legacyDir = this.getLegacyLocalSessionDir(sessionName);

    let removed = false;

    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed = true;
    }

    if (legacyDir !== dir && fs.existsSync(legacyDir)) {
      fs.rmSync(legacyDir, { recursive: true, force: true });
      removed = true;
    }

    return removed;
  }
}

module.exports = new SessionStorageProvider();
