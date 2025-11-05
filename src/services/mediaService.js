const fs = require('fs');
const path = require('path');
const MediaBatch = require('../models/MediaBatch');
const ContactGroup = require('../models/ContactGroup');
const WhatsAppInstance = require('../models/WhatsAppInstance');

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

    // ✅ SALVAR ARQUIVO DE MÍDIA (MANTIDO)
    async saveMediaFile(file, userId) {
        try {
            const userDir = path.join(this.uploadDir, userId.toString());
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }

            const fileExtension = path.extname(file.originalname);
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
            const filePath = path.join(userDir, fileName);

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

    // ✅ DETECTAR TIPO DE MÍDIA (MANTIDO)
    detectMediaType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType === 'application/pdf') return 'document';
        return 'document';
    }

    // ✅ NOVO: ENVIO DE MÍDIA DESVINCULADO DO WHATSAPP SERVICE
    async sendMediaToContact(sessionName, jid, mediaItem, caption = '', options = {}) {
        try {
            console.log(`📤 [MediaService] Enviando mídia via ${sessionName} para ${jid}`);
            
            // ✅ IMPORTAR DINAMICAMENTE O WHATSAPP SERVICE
            // Isso mantém o desacoplamento - só carrega quando necessário
            const whatsappService = require('./whatsappService');
            
            // ✅ VERIFICAR CONEXÃO DA INSTÂNCIA
            const socket = whatsappService.sockets.get(sessionName);
            if (!socket || !socket.user) {
                throw new Error(`Instância ${sessionName} não está conectada`);
            }

            // ✅ PREPARAR MENSAGEM
            const messageOptions = this.prepareMessageOptions(mediaItem, caption, options);
            
            console.log(`📦 Configuração da mídia:`, {
                type: Object.keys(messageOptions)[0],
                caption: caption || '(sem legenda)',
                mimetype: mediaItem.mimeType
            });

            // ✅ ENVIAR VIA WHATSAPP SERVICE
            const result = await socket.sendMessage(jid, messageOptions);

            console.log(`✅ [MediaService] Mídia enviada com sucesso para ${jid}`, {
                messageId: result.key?.id,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                messageId: result.key?.id,
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`❌ [MediaService] Erro ao enviar mídia para ${jid}:`, error);
            
            // ✅ CLASSIFICAR ERROS
            const errorInfo = this.classifyError(error);
            throw new Error(`${errorInfo.type}: ${error.message}`);
        }
    }

    // ✅ PREPARAR OPÇÕES DE MENSAGEM
    prepareMessageOptions(mediaItem, caption, options) {
        const mediaUrl = `http://localhost:3000${mediaItem.url}`;
        const baseConfig = { 
            url: mediaUrl,
            mimetype: mediaItem.mimeType 
        };

        // ✅ ENVIO COMO DOCUMENTO (FORÇADO)
        if (options.sendAsDocument) {
            return {
                document: {
                    ...baseConfig,
                    fileName: mediaItem.originalName
                },
                caption: caption
            };
        }

        // ✅ DETECTAR TIPO AUTOMATICAMENTE
        const mediaType = this.detectMediaType(mediaItem.mimeType);
        
        const typeMap = {
            image: { 
                image: baseConfig, 
                caption: caption 
            },
            video: { 
                video: baseConfig, 
                caption: caption 
            },
            audio: { 
                audio: baseConfig 
                // ❌ Áudio não suporta caption no WhatsApp
            },
            document: { 
                document: { 
                    ...baseConfig, 
                    fileName: mediaItem.originalName 
                }, 
                caption: caption 
            }
        };

        return typeMap[mediaType] || typeMap.document;
    }

    // ✅ CLASSIFICAR ERROS PARA MELHOR TRATAMENTO
    classifyError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('rate limit') || message.includes('too many') || message.includes('429')) {
            return { type: 'RATE_LIMIT', retryable: true };
        }
        if (message.includes('not connected') || message.includes('socket') || message.includes('connection')) {
            return { type: 'CONNECTION', retryable: true };
        }
        if (message.includes('timeout') || message.includes('waiting')) {
            return { type: 'TIMEOUT', retryable: true };
        }
        if (message.includes('blocked') || message.includes('banned')) {
            return { type: 'BLOCKED', retryable: false };
        }
        
        return { type: 'UNKNOWN', retryable: false };
    }

    // ✅ PROCESSAMENTO DE LOTE (SIMPLIFICADO)
    async processMediaBatch(batchId) {
        try {
            console.log(`🔄 [MediaService] Processando lote: ${batchId}`);
            
            const batch = await MediaBatch.findById(batchId)
                .populate('contactGroupIds')
                .populate('whatsappInstanceId');

            if (!batch) {
                throw new Error('Lote de mídia não encontrado');
            }

            // ✅ COLETAR CONTATOS ÚNICOS
            const allContacts = await this.collectUniqueContacts(batch.contactGroupIds);
            
            console.log(`📨 [MediaService] ${batch.mediaItems.length} mídias para ${allContacts.length} contatos`);

            // ✅ O PROCESSAMENTO REAL AGORA ESTÁ NO CONTROLLER
            // Esta função é mantida para compatibilidade
            return {
                batchId: batch._id,
                totalContacts: allContacts.length,
                totalSends: allContacts.length * batch.mediaItems.length,
                instance: batch.whatsappInstanceId.sessionName
            };

        } catch (error) {
            console.error(`❌ [MediaService] Erro no processamento:`, error);
            throw error;
        }
    }

    // ✅ COLETAR CONTATOS ÚNICOS
    async collectUniqueContacts(contactGroups) {
        const allContacts = [];
        const contactMap = new Map();

        for (const group of contactGroups) {
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

        return allContacts;
    }

    // ✅ FORMATAR JID (MANTIDO PARA COMPATIBILIDADE)
    formatJid(contact) {
        if (contact.whatsappId && contact.whatsappId.includes('@')) {
            return contact.whatsappId;
        } else {
            const phone = contact.phone.replace(/\D/g, '');
            return `${phone}@s.whatsapp.net`;
        }
    }

    // ✅ EXCLUIR ARQUIVOS DE MÍDIA
    async deleteMediaFile(fileUrl, userId) {
        try {
            const filename = path.basename(fileUrl);
            const userUploadDir = path.join(this.uploadDir, userId.toString());
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
    }

    // ✅ LIMPAR ARQUIVOS TEMPORÁRIOS
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

    // ✅ VERIFICAR DISPONIBILIDADE DA INSTÂNCIA
    async checkInstanceAvailability(sessionName) {
        try {
            const whatsappService = require('./whatsappService');
            const socket = whatsappService.sockets.get(sessionName);
            
            return {
                available: !!(socket && socket.user),
                sessionName: sessionName,
                timestamp: new Date()
            };
        } catch (error) {
            console.error(`❌ Erro ao verificar instância:`, error);
            return {
                available: false,
                sessionName: sessionName,
                error: error.message
            };
        }
    }
}

module.exports = new MediaService();