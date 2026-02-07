const WhatsAppInstance = require('../models/WhatsAppInstance');
const fs = require('fs');
const path = require('path');

class InstanceCleanup {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.cleanupInterval = null;
        this.isRunning = false;
    }

    // ✅ MÉTODO MELHORADO: Verificação robusta de instâncias ativas
    async isInstanceActuallyActive(sessionName) {
        try {
            // 1. Verificar no serviço WhatsApp
            if (this.whatsappService.sockets.has(sessionName)) {
                const socket = this.whatsappService.sockets.get(sessionName);
                if (socket && socket.readyState === 'OPEN') {
                    return true;
                }
            }

            // 2. Verificar estado no banco de dados
            const instance = await WhatsAppInstance.findOne({ sessionName });
            if (!instance) return false;

            // 3. Critérios mais conservadores para considerar "ativa"
            const lastActivity = new Date(instance.lastConnection || instance.createdAt);
            const minutesSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60);
            
            // Instância conectada há menos de 10 minutos = provavelmente ativa
            if (instance.status === 'connected' && minutesSinceActivity < 10) {
                return true;
            }

            // 4. Tentar ping na instância se possível
            if (this.whatsappService.isInstanceConnected) {
                const isConnected = await this.whatsappService.isInstanceConnected(sessionName);
                if (isConnected) return true;
            }

            return false;
        } catch (error) {
            console.error(`❌ [InstanceCleanup] Erro ao verificar atividade de ${sessionName}:`, error);
            // Em caso de dúvida, considerar como inativa para evitar acumulação
            return false;
        }
    }

    // ✅ MÉTODO MELHORADO: Cleanup com verificações de segurança
    async performCleanup() {
        try {
            console.log('🔍 [InstanceCleanup] Iniciando cleanup com verificações de segurança...');

            const dbInstances = await WhatsAppInstance.find({});
            const authSessionsDir = path.join(__dirname, '../auth_sessions');
            let sessionFolders = [];
            
            if (fs.existsSync(authSessionsDir)) {
                sessionFolders = fs.readdirSync(authSessionsDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
            }

            let cleanupCount = 0;
            const skippedActive = [];

            // 1. Limpeza de instâncias do banco (MAIS CONSERVADORA)
            for (const instance of dbInstances) {
                try {
                    const isActive = await this.isInstanceActuallyActive(instance.sessionName);
                    
                    if (!isActive && !sessionFolders.includes(instance.sessionName)) {
                        // ✅ SÓ remove se INATIVA e SEM pasta
                        await WhatsAppInstance.deleteOne({ _id: instance._id });
                        console.log(`🗑️ [InstanceCleanup] Instância inativa removida: ${instance.sessionName}`);
                        cleanupCount++;
                    } else if (isActive && !sessionFolders.includes(instance.sessionName)) {
                        // ⚠️ Instância ativa sem pasta - apenas log, não remove
                        console.log(`⚠️ [InstanceCleanup] Instância ATIVA sem pasta: ${instance.sessionName} - PRESERVADA`);
                        skippedActive.push(instance.sessionName);
                    }
                } catch (error) {
                    console.error(`❌ [InstanceCleanup] Erro ao processar instância ${instance.sessionName}:`, error);
                }
            }

            // 2. Limpeza de pastas (MAIS CONSERVADORA)
            for (const folderName of sessionFolders) {
                try {
                    const correspondingInstance = dbInstances.find(i => i.sessionName === folderName);
                    
                    if (!correspondingInstance) {
                        // ✅ Pasta sem instância no banco - verificar se está ativa
                        const isActive = await this.isInstanceActuallyActive(folderName);
                        
                        if (!isActive) {
                            const folderPath = path.join(authSessionsDir, folderName);
                            fs.rmSync(folderPath, { recursive: true, force: true });
                            console.log(`🗂️ [InstanceCleanup] Pasta órfã removida: ${folderName}`);
                            cleanupCount++;
                        } else {
                            console.log(`⚠️ [InstanceCleanup] Pasta de instância ATIVA sem registro: ${folderName} - PRESERVADA`);
                        }
                    }
                } catch (error) {
                    console.error(`❌ [InstanceCleanup] Erro ao processar pasta ${folderName}:`, error);
                }
            }

            // 3. Atualização de status (MAIS CONSERVADORA)
            for (const instance of dbInstances) {
                try {
                    const isActive = await this.isInstanceActuallyActive(instance.sessionName);
                    const lastConnection = new Date(instance.lastConnection || instance.createdAt);
                    const hoursSinceConnection = (Date.now() - lastConnection.getTime()) / (1000 * 60 * 60);
                    
                    // ✅ Só atualiza status se claramente inativa
                    if (instance.status === 'connected' && !isActive && hoursSinceConnection > 4) {
                        await WhatsAppInstance.findByIdAndUpdate(instance._id, {
                            status: 'disconnected',
                            qrCode: null,
                            disconnectedAt: new Date()
                        });
                        console.log(`🔄 [InstanceCleanup] Status atualizado para disconnected: ${instance.sessionName}`);
                        cleanupCount++;
                    }
                } catch (error) {
                    console.error(`❌ [InstanceCleanup] Erro ao atualizar status ${instance.sessionName}:`, error);
                }
            }

            // Log final detalhado
            if (cleanupCount > 0 || skippedActive.length > 0) {
                console.log(`✅ [InstanceCleanup] Cleanup concluído: ${cleanupCount} itens processados`);
                if (skippedActive.length > 0) {
                    console.log(`📋 [InstanceCleanup] Instâncias ativas preservadas: ${skippedActive.join(', ')}`);
                }
            } else {
                console.log(`✅ [InstanceCleanup] Nenhuma instância órfã/inativa encontrada`);
            }

        } catch (error) {
            console.error('❌ [InstanceCleanup] Erro durante cleanup:', error);
        }
    }

    // ✅ CONFIGURAÇÃO MAIS SEGURA
    startAutoCleanup() {
        if (this.isRunning) {
            console.log('⚠️ [InstanceCleanup] Cleanup automático já está rodando');
            return;
        }

        console.log('🧹 [InstanceCleanup] Iniciando cleanup automático SEGURO...');
        this.isRunning = true;

        // ✅ Intervalo maior para primeira execução
        setTimeout(() => {
            this.performCleanup();
        }, 5 * 60 * 1000); // 5 minutos

        // ✅ Intervalo maior entre execuções
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60 * 60 * 1000); // 60 minutos (1 hora)
    }

    // ✅ MÉTODO MELHORADO: Cleanup manual com verificações
    async cleanupInstance(sessionName) {
        try {
            console.log(`🧹 [InstanceCleanup] Iniciando limpeza manual segura: ${sessionName}`);

            // Verificar se está ativa antes de limpar
            const isActive = await this.isInstanceActuallyActive(sessionName);
            if (isActive) {
                console.log(`⚠️ [InstanceCleanup] Instância ${sessionName} está ATIVA - abortando limpeza`);
                throw new Error(`Não é possível limpar instância ativa: ${sessionName}`);
            }

            await this.whatsappService.deleteInstance(sessionName);
            console.log(`✅ [InstanceCleanup] Instância ${sessionName} limpa com sucesso`);

        } catch (error) {
            console.error(`❌ [InstanceCleanup] Erro na limpeza manual de ${sessionName}:`, error.message);
            throw error;
        }
    }

    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            this.isRunning = false;
            console.log('🛑 [InstanceCleanup] Cleanup automático parado');
        } else {
            console.log('⚠️ [InstanceCleanup] Cleanup automático não estava rodando');
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