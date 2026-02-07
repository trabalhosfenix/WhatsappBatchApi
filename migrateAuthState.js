// 📁 scripts/migrateAuthState.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateAuthState(sessionName) {
    const authDir = path.join(__dirname, '../auth_sessions', sessionName);
    
    if (!fs.existsSync(authDir)) {
        console.log(`❌ Diretório de sessão não encontrado: ${sessionName}`);
        return;
    }

    try {
        // Verificar e atualizar creds.json
        const credsPath = path.join(authDir, 'creds.json');
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
            
            // ✅ ADICIONAR: Campos necessários para Baileys 7.0.0
            if (!creds.lidMapping) {
                creds.lidMapping = {};
                console.log(`✅ Adicionado lidMapping às creds de ${sessionName}`);
            }
            
            if (!creds.deviceIndex) {
                creds.deviceIndex = 0;
                console.log(`✅ Adicionado deviceIndex às creds de ${sessionName}`);
            }

            fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
            console.log(`✅ Creds migradas para ${sessionName}`);
        }

        console.log(`🎉 Migração concluída para ${sessionName}`);
    } catch (error) {
        console.error(`❌ Erro na migração de ${sessionName}:`, error);
    }
}

// Executar migração para todas as sessões
export async function migrateAllSessions() {
    const sessionsDir = path.join(__dirname, '../auth_sessions');
    
    if (!fs.existsSync(sessionsDir)) {
        console.log('ℹ️ Nenhuma sessão encontrada para migrar');
        return;
    }

    const sessions = fs.readdirSync(sessionsDir);
    console.log(`🔄 Migrando ${sessions.length} sessões...`);

    for (const session of sessions) {
        await migrateAuthState(session);
    }

    console.log('✅ Todas as sessões migradas para Baileys 7.0.0');
}