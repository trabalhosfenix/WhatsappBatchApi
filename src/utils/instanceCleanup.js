const WhatsAppInstance = require('../models/WhatsAppInstance');
const fs = require('fs');
const path = require('path');

class InstanceCleanup {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.cleanupInterval = null;
        this.isRunning = false;
    }

    // Iniciar cleanup automático a cada 30 minutos
    startAutoCleanup() {
        if (this.isRunning) {
            console.log('⚠️ [InstanceCleanup] Cleanup automático já está rodando');
            return;
        }

        console.log('🧹 [InstanceCleanup] Iniciando cleanup automático...');
        this.isRunning = true;

        // Executar imediatamente
        this.performCleanup();

        // Agendar execução a cada 30 minutos
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 30 * 60 * 1000); // 30 minutos
    }

    // Parar cleanup automático
    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 [InstanceCleanup] Cleanup automático parado');
    }

    // Executar limpeza de instâncias órfãs
    async performCleanup() {
        try {
            console.log('🔍 [InstanceCleanup] Verificando instâncias órfãs...');

            // 1. Buscar todas as instâncias no banco
            const dbInstances = await WhatsAppInstance.find({});
            
            // 2. Buscar todas as pastas de sessão no filesystem
            const authSessionsDir = path.join(__dirname, '../auth_sessions');
            let sessionFolders = [];
            
            if (fs.existsSync(authSessionsDir)) {
                sessionFolders = fs.readdirSync(authSessionsDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
            }

            // 3. Identificar instâncias órfãs no banco (sem pasta de sessão)
            const orphanedDbInstances = dbInstances.filter(instance => 
                !sessionFolders.includes(instance.sessionName)
            );

            // 4. Identificar pastas órfãs (sem registro no banco)
            const orphanedFolders = sessionFolders.filter(folderName => 
                !dbInstances.some(instance => instance.sessionName === folderName)
            );

            // 5. Identificar instâncias com status inconsistente
            const staleInstances = dbInstances.filter(instance => {
                const lastConnection = new Date(instance.lastConnection || instance.createdAt);
                const hoursSinceLastConnection = (Date.now() - lastConnection.getTime()) / (1000 * 60 * 60);
                
                // Instâncias "conectadas" há mais de 2 horas sem atividade real
                return instance.status === 'connected' && hoursSinceLastConnection > 2 &&
                       !this.whatsappService.sockets.has(instance.sessionName);
            });

            let cleanupCount = 0;

            // Limpar instâncias órfãs no banco
            for (const instance of orphanedDbInstances) {
                try {
                    await WhatsAppInstance.deleteOne({ _id: instance._id });
                    console.log(`🗑️ [InstanceCleanup] Instância órfã removida do banco: ${instance.sessionName}`);
                    cleanupCount++;
                } catch (error) {
                    console.error(`❌ [InstanceCleanup] Erro ao remover instância ${instance.sessionName}:`, error);
                }
            }

            // Limpar pastas órfãs
            for (const folderName of orphanedFolders) {
                try {
                    const folderPath = path.join(authSessionsDir, folderName);
                    fs.rmSync(folderPath, { recursive: true, force: true });
                    console.log(`🗂️ [InstanceCleanup] Pasta órfã removida: ${folderName}`);
                    cleanupCount++;
                } catch (error) {
                    console.error(`❌ [InstanceCleanup] Erro ao remover pasta ${folderName}:`, error);
                }
            }

            // Atualizar status de instâncias obsoletas
            for (const instance of staleInstances) {
                try {
                    await WhatsAppInstance.findByIdAndUpdate(instance._id, {
                        status: 'disconnected',
                        qrCode: null
                    });
                    console.log(`🔄 [InstanceCleanup] Status atualizado para disconnected: ${instance.sessionName}`);
                    cleanupCount++;
                } catch (error) {
                    console.error(`❌ [InstanceCleanup] Erro ao atualizar status ${instance.sessionName}:`, error);
                }
            }

            if (cleanupCount > 0) {
                console.log(`✅ [InstanceCleanup] Cleanup concluído: ${cleanupCount} itens processados`);
            } else {
                console.log(`✅ [InstanceCleanup] Nenhuma instância órfã encontrada`);
            }

        } catch (error) {
            console.error('❌ [InstanceCleanup] Erro durante cleanup:', error);
        }
    }

    // Cleanup manual de uma instância específica
    async cleanupInstance(sessionName) {
        try {
            console.log(`🧹 [InstanceCleanup] Limpeza manual da instância: ${sessionName}`);

            // Remover do serviço WhatsApp
            await this.whatsappService.deleteInstance(sessionName);

            console.log(`✅ [InstanceCleanup] Instância ${sessionName} limpa com sucesso`);

        } catch (error) {
            console.error(`❌ [InstanceCleanup] Erro na limpeza manual de ${sessionName}:`, error);
            throw error;
        }
    }

    // Obter estatísticas de limpeza
    async getCleanupStats() {
        try {
            const dbInstances = await WhatsAppInstance.find({});
            const authSessionsDir = path.join(__dirname, '../auth_sessions');
            
            let sessionFolders = [];
            if (fs.existsSync(authSessionsDir)) {
                sessionFolders = fs.readdirSync(authSessionsDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
            }

            const activeConnections = this.whatsappService.sockets.size;

            return {
                totalDbInstances: dbInstances.length,
                totalSessionFolders: sessionFolders.length,
                activeConnections: activeConnections,
                connectedInstances: dbInstances.filter(i => i.status === 'connected').length,
                disconnectedInstances: dbInstances.filter(i => i.status === 'disconnected').length,
                connectingInstances: dbInstances.filter(i => i.status === 'connecting').length,
                isCleanupRunning: this.isRunning
            };

        } catch (error) {
            console.error('❌ [InstanceCleanup] Erro ao obter estatísticas:', error);
            return null;
        }
    }
}

module.exports = InstanceCleanup;