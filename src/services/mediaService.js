// src/services/mediaService.js
const fs = require('fs');
const path = require('path');
const MediaBatch = require('../models/MediaBatch');
const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const whatsappBaileysService = require('./whatsappService');

class MediaService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../uploads/media');
        this.ensureUploadDir();
    }

    ensureUploadDir() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    // Salvar arquivo de mídia localmente
    async saveMediaFile(file, userId) {
        try {
            const userDir = path.join(this.uploadDir, userId.toString());
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }

            const fileExtension = path.extname(file.originalname);
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
            const filePath = path.join(userDir, fileName);

            // Mover arquivo para o diretório
            await fs.promises.writeFile(filePath, file.buffer);

            return {
                fileName,
                originalName: file.originalname,
                mimeType: file.mimetype,
                fileSize: file.size,
                localPath: filePath,
                url: `/media/${userId}/${fileName}`
            };
        } catch (error) {
            console.error('❌ Erro ao salvar arquivo de mídia:', error);
            throw new Error(`Falha ao salvar arquivo: ${error.message}`);
        }
    }

    // Detectar tipo de mídia baseado no MIME type
    detectMediaType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType === 'application/pdf') return 'document';
        return 'document';
    }

    /// ✅ CORREÇÃO: Remover caption duplicado e usar options consistentemente
    async prepareMediaForSending(mediaItem, options = {}) {
        try {
            const mediaType = this.detectMediaType(mediaItem.mimeType);
            const fileBuffer = await fs.promises.readFile(mediaItem.localPath);

            // ✅ USAR CAPTION CORRETAMENTE
            const caption = options.caption || '';

            const mediaConfig = {
                [mediaType]: {
                    url: mediaItem.localPath,
                    mimetype: mediaItem.mimeType,
                    caption: caption, // ← USAR VARIÁVEL
                }
            };

            if (options.sendAsDocument) {
                return {
                    document: {
                        url: mediaItem.localPath,
                        mimetype: mediaItem.mimeType,
                        fileName: mediaItem.originalName
                    },
                    caption: caption // ← MESMO CAPTION
                };
            }

            return mediaConfig;
        } catch (error) {
            console.error('❌ Erro ao preparar mídia:', error);
            throw error;
        }
    }

    // Criar lote de mídia
    async createMediaBatch(batchData) {
        try {
            const { userId, whatsappInstanceId, name, mediaItems, contactGroupIds, options } = batchData;

            // Verificar instância
            const instance = await WhatsAppInstance.findOne({
                _id: whatsappInstanceId,
                userId
            });

            if (!instance || instance.status !== 'connected') {
                throw new Error('Instância WhatsApp não encontrada ou não conectada');
            }

            // Verificar grupos
            const contactGroups = await ContactGroup.find({
                _id: { $in: contactGroupIds },
                userId
            });

            if (contactGroups.length !== contactGroupIds.length) {
                throw new Error('Um ou mais grupos de contatos não foram encontrados');
            }

            // Calcular total de envios
            const totalContacts = contactGroups.reduce((total, group) => total + group.contactCount, 0);
            const totalSends = totalContacts * mediaItems.length;

            if (totalSends === 0) {
                throw new Error('Nenhum contato disponível para envio');
            }

            // Criar lote
            const mediaBatch = await MediaBatch.create({
                userId,
                whatsappInstanceId,
                name,
                mediaItems,
                caption: options?.caption || '4uick test caption',
                contactGroupIds,
                progress: {
                    total: totalSends,
                    sent: 0,
                    failed: 0
                },
                options: {
                    delayBetweenMessages: options?.delayBetweenMessages || 2000,
                    sendAsDocument: options?.sendAsDocument || false,
                    caption: options?.caption || '4uick test caption' // ← Incluir caption
                }
            });


            // Iniciar processamento em background
            this.processMediaBatch(mediaBatch._id);

            return mediaBatch;

        } catch (error) {
            console.error('❌ Erro ao criar lote de mídia:', error);
            throw error;
        }
    }

    // Processar lote de mídia
    async processMediaBatch(batchId) {
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                await this.processBatchWithRetry(batchId, retryCount);
                break; // Sucesso, sair do loop
            } catch (error) {
                retryCount++;
                console.error(`❌ Tentativa ${retryCount}/${maxRetries} falhou:`, error.message);

                if (retryCount < maxRetries) {
                    // Aguardar antes de tentar novamente
                    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                    console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Última tentativa falhou
                    await this.markBatchAsFailed(batchId, error);
                }
            }
        }
    }


    // ADICIONE ESTE MÉTODO ao mediaService.js (se não existir)
    async sendMediaToContact(sessionName, jid, mediaConfig) {
        try {
            console.log(`📤 [MediaService] Enviando mídia via ${sessionName} para ${jid}`);

            const socket = whatsappBaileysService.sockets.get(sessionName);
            if (!socket || !socket.user) {
                throw new Error(`Instância ${sessionName} não está conectada`);
            }

            console.log(`📄 Configuração da mídia:`, {
                type: Object.keys(mediaConfig)[0],
                caption: mediaConfig.caption || 'Sem legenda',
                mimetype: mediaConfig[Object.keys(mediaConfig)[0]]?.mimetype
            });

            // Enviar a mensagem usando o socket do Baileys
            const result = await socket.sendMessage(jid, mediaConfig);

            console.log(`✅ [MediaService] Mídia enviada com sucesso para ${jid}`, {
                messageId: result.key?.id,
                timestamp: new Date().toISOString()
            });

            return result;

        } catch (error) {
            console.error(`❌ [MediaService] Erro ao enviar mídia para ${jid}:`, error);
            throw error;
        }
    }


    async processBatchWithRetry(batchId, retryCount) {
        console.log(`🔄 Processando lote ${batchId} (tentativa ${retryCount + 1})`);

        const batch = await MediaBatch.findById(batchId)
            .populate('contactGroupIds')
            .populate('whatsappInstanceId');

        if (!batch) {
            throw new Error('Lote de mídia não encontrado');
        }

        // ✅ CORREÇÃO: DEBUG DETALHADO DO CAPTION
        console.log('🔍 DEBUG CAPTION NO BATCH:', {
            batchCaption: batch.caption,
            optionsCaption: batch.options?.caption,
            fullBatchData: {
                name: batch.name,
                caption: batch.caption,
                options: batch.options
            }
        });

        // VERIFICAÇÃO ROBUSTA DA INSTÂNCIA
        const instance = batch.whatsappInstanceId;
        const socket = whatsappBaileysService.sockets.get(instance.sessionName);

        if (!socket || !socket.user) {
            throw new Error(`Instância "${instance.sessionName}" não disponível. Status: ${instance.status}`);
        }

        // Teste de conexão antes de iniciar
        try {
            await this.testInstanceConnection(instance.sessionName);
        } catch (error) {
            throw new Error(`Instância não responde: ${error.message}`);
        }

        console.log(`✅ Instância verificada e conectada: ${instance.sessionName}`);

        // Atualizar status
        await MediaBatch.findByIdAndUpdate(batchId, { status: 'processing' });

        const results = [];
        const allContacts = await this.collectUniqueContacts(batch.contactGroupIds);

        console.log(`📨 Enviando ${batch.mediaItems.length} mídias para ${allContacts.length} contatos`);

        let sentCount = 0;
        let failedCount = 0;

        // Processar envios
        for (const mediaItem of batch.mediaItems) {
            for (const contact of allContacts) {
                try {



                    // Verificar conexão antes de cada envio
                    if (!this.isInstanceAvailable(instance.sessionName)) {
                        throw new Error('Instância ficou indisponível durante o envio');
                    }

                    const jid = this.formatJid(contact);
                    console.log(`📤 Enviando ${mediaItem.originalName} para: ${contact.name} (${jid})`);

                    const caption = batch.caption || batch.options?.caption || '';
                    console.log(`🖋️ Legenda final: "${caption}"`);


                    const sendOptions = {
                        ...batch.options,
                        caption: caption // ← GARANTIR QUE O CAPTION VAI
                    };


                    console.log('📝 Opções:', sendOptions);
                    console.log('🖋️ Legenda:', `"${caption}"`);

                    const messageResult = await whatsappBaileysService.sendMediaToContact(
                        instance.sessionName,
                        jid,
                        mediaItem,
                        caption, // ← PASSAR CAPTION DIRETAMENTE
                        sendOptions // ← PASSAR OPTIONS COM CAPTION
                    );

                    sentCount++;
                    results.push({
                        contact: contact.name,
                        phone: contact.phone,
                        mediaItem: mediaItem.originalName,
                        status: 'sent',
                        messageId: messageResult?.key?.id,
                        timestamp: new Date()
                    });

                    console.log(`✅ ${mediaItem.originalName} enviado para ${contact.name}`);

                    // Atualizar progresso
                    await MediaBatch.findByIdAndUpdate(batchId, {
                        'progress.sent': sentCount,
                        'progress.failed': failedCount
                    });

                    // Delay entre envios
                    if (batch.options?.delayBetweenMessages) {
                        await new Promise(resolve =>
                            setTimeout(resolve, batch.options.delayBetweenMessages)
                        );
                    }

                } catch (error) {
                    console.error(`❌ Erro ao enviar para--> ${contact.name}:`, error.message);
                    failedCount++;
                    results.push({
                        contact: contact.name,
                        phone: contact.phone,
                        mediaItem: mediaItem.originalName,
                        status: 'failed',
                        error: error.message,
                        timestamp: new Date()
                    });

                    await MediaBatch.findByIdAndUpdate(batchId, {
                        'progress.failed': failedCount
                    });
                }
            }
        }

        // Finalizar lote
        const finalStatus = failedCount === 0 ? 'completed' :
            sentCount === 0 ? 'failed' : 'completed_with_errors';

        await MediaBatch.findByIdAndUpdate(batchId, {
            status: finalStatus,
            'progress.sent': sentCount,
            'progress.failed': failedCount,
            results: results
        });

        console.log(`✅ Lote ${batch.name} finalizado: ${sentCount} enviados, ${failedCount} falhas`);
    }

    // Novos métodos auxiliares
    async testInstanceConnection(sessionName) {
        const socket = whatsappBaileysService.sockets.get(sessionName);
        if (!socket || !socket.user) {
            throw new Error('Instância não disponível');
        }

        // Tentar obter o perfil da instância como teste
        try {
            await socket.fetchBlocklist();
            return true;
        } catch (error) {
            throw new Error(`Instância não responde: ${error.message}`);
        }
    }

    isInstanceAvailable(sessionName) {
        const socket = whatsappBaileysService.sockets.get(sessionName);
        return !!(socket && socket.user);
    }

    async sendMediaToContactWithRetry(sessionName, jid, mediaConfig, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.sendMediaToContact(sessionName, jid, mediaConfig);
            } catch (error) {
                if (attempt === maxRetries) throw error;

                console.log(`🔄 Retentativa ${attempt}/${maxRetries} para ${jid}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    // ✅ FUNÇÃO PARA EXCLUIR ARQUIVOS DE MÍDIA
    async deleteMediaFile (fileUrl, userId) {
        try {
            // Extrair nome do arquivo da URL
            const filename = path.basename(fileUrl);
            const userUploadDir = path.join(uploadDir, userId.toString());
            const filePath = path.join(userUploadDir, filename);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`✅ Arquivo excluído: ${filename}`);
                return true;
            }

            console.log(`⚠️ Arquivo não encontrado: ${filename}`);
            return false;
        } catch (error) {
            console.error(`❌ Erro ao excluir arquivo:`, error);
            throw error;
        }
    };

    async markBatchAsFailed(batchId, error) {
        await MediaBatch.findByIdAndUpdate(batchId, {
            status: 'failed',
            $push: {
                results: {
                    contact: 'Sistema',
                    phone: 'N/A',
                    mediaItem: 'Sistema',
                    status: 'failed',
                    error: `Falha após múltiplas tentativas: ${error.message}`,
                    timestamp: new Date()
                }
            }
        });
    }

    // Limpar arquivos temporários
    async cleanupMediaFiles(userId) {
        try {
            const userDir = path.join(this.uploadDir, userId.toString());
            if (fs.existsSync(userDir)) {
                await fs.promises.rm(userDir, { recursive: true, force: true });
                console.log(`🧹 Arquivos de mídia do usuário ${userId} limpos`);
            }
        } catch (error) {
            console.error('❌ Erro ao limpar arquivos de mídia:', error);
        }
    }
}

module.exports = new MediaService();