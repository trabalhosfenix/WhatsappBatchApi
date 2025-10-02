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

    // Preparar mídia para envio via Baileys
    async prepareMediaForSending(mediaItem, options = {}) {
        try {
            const mediaType = this.detectMediaType(mediaItem.mimeType);
            
            // Ler arquivo como buffer
            const fileBuffer = await fs.promises.readFile(mediaItem.localPath);
            
            const mediaConfig = {
                [mediaType]: {
                    url: mediaItem.localPath, // Baileys lê do filesystem
                    mimetype: mediaItem.mimeType,
                    caption: options.caption || mediaItem.caption || ''
                }
            };

            // Se for para enviar como documento, forçar tipo
            if (options.sendAsDocument) {
                return {
                    document: {
                        url: mediaItem.localPath,
                        mimetype: mediaItem.mimeType,
                        fileName: mediaItem.originalName
                    },
                    caption: options.caption || mediaItem.caption || ''
                };
            }

            return mediaConfig;
        } catch (error) {
            console.error('❌ Erro ao preparar mídia:', error);
            throw new Error(`Falha ao preparar mídia: ${error.message}`);
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
                contactGroupIds,
                progress: {
                    total: totalSends,
                    sent: 0,
                    failed: 0
                },
                options: options || {
                    delayBetweenMessages: 2000,
                    sendAsDocument: false
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
        try {
            console.log(`🔄 Processando lote de mídia: ${batchId}`);
            
            const batch = await MediaBatch.findById(batchId)
                .populate('contactGroupIds')
                .populate('whatsappInstanceId');

            if (!batch) {
                throw new Error('Lote de mídia não encontrado');
            }

            // Atualizar status
            await MediaBatch.findByIdAndUpdate(batchId, { status: 'processing' });

            const instance = batch.whatsappInstanceId;
            const results = [];

            // Coletar todos os contatos únicos
            const allContacts = [];
            const contactMap = new Map();

            for (const group of batch.contactGroupIds) {
                const contactGroup = await ContactGroup.findById(group._id);
                if (contactGroup && contactGroup.contacts) {
                    for (const contact of contactGroup.contacts) {
                        const contactKey = `${contact.phone}-${contact.whatsappId || contact.phone}`;
                        if (!contactMap.has(contactKey)) {
                            contactMap.set(contactKey, true);
                            allContacts.push({
                                ...contact.toObject(),
                                groupName: contactGroup.name
                            });
                        }
                    }
                }
            }

            console.log(`📨 Enviando ${batch.mediaItems.length} mídias para ${allContacts.length} contatos`);

            let sentCount = 0;
            let failedCount = 0;

            // Processar cada mídia para cada contato
            for (const mediaItem of batch.mediaItems) {
                for (const contact of allContacts) {
                    try {
                        let jid;
                        if (contact.whatsappId && contact.whatsappId.includes('@')) {
                            jid = contact.whatsappId;
                        } else {
                            const phone = contact.phone.replace(/\D/g, '');
                            jid = `${phone}@s.whatsapp.net`;
                        }

                        console.log(`📤 Enviando ${mediaItem.originalName} para: ${contact.name} (${jid})`);

                        // Preparar e enviar mídia
                        const mediaConfig = await this.prepareMediaForSending(mediaItem, batch.options);
                        const messageResult = await this.sendMediaToContact(
                            instance.sessionName,
                            jid,
                            mediaConfig
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
                        console.error(`❌ Erro ao enviar ${mediaItem.originalName} para ${contact.name}:`, error.message);

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
            const finalStatus = failedCount === batch.progress.total ? 'failed' : 'completed';

            await MediaBatch.findByIdAndUpdate(batchId, {
                status: finalStatus,
                'progress.sent': sentCount,
                'progress.failed': failedCount,
                results: results
            });

            console.log(`✅ Lote de mídia ${batch.name} finalizado: ${sentCount} enviados, ${failedCount} falhas`);

        } catch (error) {
            console.error(`❌ Erro no processamento do lote de mídia ${batchId}:`, error);

            await MediaBatch.findByIdAndUpdate(batchId, {
                status: 'failed',
                $push: {
                    results: {
                        contact: 'Sistema',
                        phone: 'N/A',
                        mediaItem: 'Sistema',
                        status: 'failed',
                        error: error.message,
                        timestamp: new Date()
                    }
                }
            });
        }
    }

    // Enviar mídia para contato (usando serviço WhatsApp existente)
    async sendMediaToContact(sessionName, jid, mediaConfig) {
        const socket = whatsappBaileysService.sockets.get(sessionName);
        
        if (!socket || !socket.user) {
            throw new Error('Instância WhatsApp não disponível');
        }

        // Formatar JID
        let formattedJid = jid;
        if (!jid.includes('@')) {
            const phone = jid.replace(/\D/g, '');
            formattedJid = `${phone}@s.whatsapp.net`;
        }

        console.log(`🚀 [${sessionName}] Enviando mídia para: ${formattedJid}`);

        // Enviar via Baileys
        const result = await socket.sendMessage(formattedJid, mediaConfig);
        
        console.log(`✅ [${sessionName}] Mídia enviada com sucesso para: ${formattedJid}`);
        return result;
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