require('dotenv').config();
const fs = require('fs');
const path = require('path');

const localBase = path.join(__dirname, '..', 'src', 'auth_sessions');
const sharedBase = process.env.SHARED_SESSIONS_PATH;

if (!sharedBase) {
  console.error('❌ SHARED_SESSIONS_PATH não configurado.');
  process.exit(1);
}

if (!fs.existsSync(localBase)) {
  console.log('ℹ️ Nenhum diretório local auth_sessions encontrado. Nada para migrar.');
  process.exit(0);
}

fs.mkdirSync(sharedBase, { recursive: true });

const sessionDirs = fs.readdirSync(localBase, { withFileTypes: true }).filter((d) => d.isDirectory());

for (const dir of sessionDirs) {
  const from = path.join(localBase, dir.name);
  const to = path.join(sharedBase, dir.name);

  if (fs.existsSync(to)) {
    console.log(`⚠️ Sessão ${dir.name} já existe no destino, pulando.`);
    continue;
  }

  fs.renameSync(from, to);
  console.log(`✅ Migrada: ${dir.name}`);
}

console.log('🎉 Migração de sessões concluída.');
