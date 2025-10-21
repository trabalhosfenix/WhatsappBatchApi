const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require('@whiskeysockets/baileys');
const WhatsAppInstance = require('../models/WhatsAppInstance');
const ContactGroup = require('../models/ContactGroup');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Logger silencioso como no bot que funciona
const baileysLogger = {
    level: 'silent',
    trace: () => { },
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
    fatal: () => { },
    child: () => baileysLogger
};

class WhatsAppService {
    constructor() {
        this.sockets = new Map();
        this.authStates = new Map();
        this.reconnectionAttempts = new Map();
        this.maxReconnectAttempts = 3; // Reduzido
        this.initializingInstances = new Set();
        this.reconnectionTimers = new Map();
        this.connectionStates = new Map(); // Novo: controle de estado
    }

    listActiveInstances() {
        console.log('📋 Instâncias ativas no WhatsAppService:');
        console.log('- Sockets:', Array.from(this.sockets.keys()));
        console.log('- AuthStates:', Array.from(this.authStates.keys()));
        console.log('- ReconnectionAttempts:', Array.from(this.reconnectionAttempts.keys()));

        return {
            sockets: Array.from(this.sockets.keys()),
            authStates: Array.from(this.authStates.keys()),
            reconnectionAttempts: Object.fromEntries(this.reconnectionAttempts)
        };
    }

    async deleteInstance(sessionName) {
        console.log(`🗑️ Deletando instância WhatsApp: ${sessionName}`);

        try {
            // Limpar todos os recursos
            if (this.reconnectionTimers.has(sessionName)) {
                clearTimeout(this.reconnectionTimers.get(sessionName));
                this.reconnectionTimers.delete(sessionName);
            }

            const socket = this.sockets.get(sessionName);
            if (socket) {
                try {
                    await socket.end();
                } catch (err) {
                    console.log(`⚠️ Erro ao finalizar socket: ${err.message}`);
                }
                this.sockets.delete(sessionName);
            }

            this.authStates.delete(sessionName);
            this.reconnectionAttempts.delete(sessionName);
            this.initializingInstances.delete(sessionName);
            this.connectionStates.delete(sessionName);

            // Remover arquivos de sessão
            const sessionDir = path.join(__dirname, '..', 'auth_sessions', sessionName);
            if (fs.existsSync(sessionDir)) {
                console.log(`🗂️ Removendo diretório de sessão: ${sessionDir}`);
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }

            // Remover do banco
            await WhatsAppInstance.findOneAndDelete({ sessionName });

            console.log(`✅ Instância ${sessionName} deletada com sucesso`);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao deletar instância ${sessionName}:`, error);
            throw error;
        }
    }

    async createClient(sessionName, userId) {
        try {
            console.log(`🔧 [Baileys] Criando cliente: ${sessionName} para usuário: ${userId}`);

            // Verificar se já existe
            const existingInstance = await WhatsAppInstance.findOne({
                sessionName,
                userId
            });

            if (existingInstance) {
                throw new Error(`Já existe uma instância com o nome "${sessionName}"`);
            }

            // Criar instância no banco
            const instance = await WhatsAppInstance.create({
                userId,
                sessionName,
                status: 'connecting'
            });

            console.log(`📝 [Baileys] Instância criada no banco: ${instance._id}`);

            // Inicializar o cliente
            await this.initializeClient(sessionName, userId, instance._id);

            console.log(`✅ [Baileys] Cliente inicializado: ${sessionName}`);
            return instance;

        } catch (error) {
            console.error(`❌ [Baileys] Erro ao criar cliente:`, error);

            // Limpar se falhou
            try {
                await WhatsAppInstance.findOneAndDelete({ sessionName, userId });
            } catch (dbError) {
                console.error('❌ Erro ao limpar instância falha:', dbError);
            }

            throw new Error(`Erro ao criar cliente WhatsApp: ${error.message}`);
        }
    }

    async initializeClient(sessionName, userId, instanceId) {
        // Evitar inicializações duplicadas
        if (this.initializingInstances.has(sessionName)) {
            console.log(`⚠️ [${sessionName}] Já está sendo inicializada, ignorando...`);
            return this.sockets.get(sessionName);
        }

        this.initializingInstances.add(sessionName);
        this.connectionStates.set(sessionName, 'initializing');

        try {
            // Diretório para sessão
            const authDir = path.join(__dirname, '../auth_sessions', sessionName);
            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir, { recursive: true });
            }

            // Carregar estado de autenticação
            const { state, saveCreds } = await useMultiFileAuthState(authDir);

            // Buscar versão
            const { version } = await fetchLatestBaileysVersion();
            console.log(`📦 [${sessionName}] Baileys versão: ${version.join('.')}`);

            // Configuração SIMPLIFICADA - igual ao bot que funciona
            const socket = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
                },
                logger: baileysLogger,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: false,
                syncFullHistory: false,
                retryRequestDelayMs: 2000,
                maxMsgRetryCount: 2,
                connectTimeoutMs: 30000,
                keepAliveIntervalMs: 30000,
                // Configurações mínimas para estabilidade
                fireInitQueries: true,
                emitOwnEvents: true,
                defaultBrowser: 'Chrome',
                printQRInTerminal: false // REMOVIDO para evitar warning
            });

            // Salvar credenciais
            socket.ev.on('creds.update', saveCreds);

            // Configurar eventos
            this.setupBaileysEvents(socket, sessionName, instanceId, userId, saveCreds);

            this.sockets.set(sessionName, socket);
            this.authStates.set(sessionName, { state, saveCreds });
            this.reconnectionAttempts.set(sessionName, 0);
            this.connectionStates.set(sessionName, 'connected');

            return socket;

        } catch (error) {
            console.error(`❌ [${sessionName}] Erro na inicialização:`, error);
            this.connectionStates.set(sessionName, 'failed');
            throw error;
        } finally {
            this.initializingInstances.delete(sessionName);
        }
    }

    setupBaileysEvents(socket, sessionName, instanceId, userId, saveCreds) {
        let qrTimeout;

        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            console.log(`🔗 [${sessionName}] Status: ${connection}`);

            try {
                switch (connection) {
                    case 'close':
                        console.log(`🔌 [${sessionName}] Conexão fechada`);
                        this.connectionStates.set(sessionName, 'disconnected');

                        // Limpar timeout do QR se existir
                        if (qrTimeout) clearTimeout(qrTimeout);

                        const shouldReconnect =
                            lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                        if (shouldReconnect) {
                            const attempts = this.reconnectionAttempts.get(sessionName) || 0;
                            if (attempts < this.maxReconnectAttempts) {
                                console.log(`🔄 [${sessionName}] Tentando reconectar... (${attempts + 1}/${this.maxReconnectAttempts})`);
                                this.reconnectionAttempts.set(sessionName, attempts + 1);

                                const reconnectDelay = Math.min(2000 + (attempts * 1000), 5000);

                                // Usar debounce para evitar múltiplas reconexões
                                if (this.reconnectionTimers.has(sessionName)) {
                                    clearTimeout(this.reconnectionTimers.get(sessionName));
                                }

                                const timer = setTimeout(async () => {
                                    this.reconnectionTimers.delete(sessionName);
                                    if (this.connectionStates.get(sessionName) === 'disconnected') {
                                        await this.safeReconnect(sessionName, userId, instanceId);
                                    }
                                }, reconnectDelay);

                                this.reconnectionTimers.set(sessionName, timer);
                            } else {
                                console.log(`❌ [${sessionName}] Máximo de tentativas de reconexão atingido`);
                                await this.cleanupInstance(sessionName, instanceId, 'failed');
                            }
                        } else {
                            console.log(`🚫 [${sessionName}] Deslogado, reconexão não necessária`);
                            await this.cleanupInstance(sessionName, instanceId, 'disconnected');
                        }
                        break;

                    case 'open':
                        console.log(`✅ [${sessionName}] Conectado com sucesso!`);
                        this.connectionStates.set(sessionName, 'connected');
                        this.reconnectionAttempts.set(sessionName, 0);

                        // Limpar timer de reconexão
                        if (this.reconnectionTimers.has(sessionName)) {
                            clearTimeout(this.reconnectionTimers.get(sessionName));
                            this.reconnectionTimers.delete(sessionName);
                        }

                        // Atualizar banco
                        await WhatsAppInstance.findByIdAndUpdate(instanceId, {
                            status: 'connected',
                            qrCode: null,
                            phoneNumber: socket.user?.id?.replace(/:\d+$/, '') || 'N/A',
                            lastConnection: new Date()
                        });
                        break;

                    case 'connecting':
                        console.log(`🔄 [${sessionName}] Conectando...`);
                        this.connectionStates.set(sessionName, 'connecting');
                        await WhatsAppInstance.findByIdAndUpdate(instanceId, {
                            status: 'connecting'
                        });
                        break;
                }

                // Gerar QR Code se disponível
                if (qr) {
                    console.log(`📱 [${sessionName}] QR Code recebido`);

                    try {
                        const qrCodeImage = await qrcode.toDataURL(qr);

                        await WhatsAppInstance.findByIdAndUpdate(instanceId, {
                            qrCode: qrCodeImage,
                            status: 'connecting'
                        });

                        console.log(`✅ [${sessionName}] QR Code salvo no banco`);

                        // Timeout para QR Code expirado
                        if (qrTimeout) clearTimeout(qrTimeout);
                        qrTimeout = setTimeout(async () => {
                            console.log(`⏰ [${sessionName}] QR Code expirado`);
                            await WhatsAppInstance.findByIdAndUpdate(instanceId, {
                                qrCode: null
                            });
                        }, 120000); // 2 minutos

                    } catch (qrError) {
                        console.error(`❌ [${sessionName}] Erro ao gerar QR Code:`, qrError);
                    }
                }

            } catch (error) {
                console.error(`❌ [${sessionName}] Erro no evento de conexão:`, error);
            }
        });

        // Evento de credenciais com debounce
        let credUpdateTimeout;
        socket.ev.on('creds.update', () => {
            clearTimeout(credUpdateTimeout);
            credUpdateTimeout = setTimeout(() => {
                console.log(`🔐 [${sessionName}] Credenciais atualizadas`);
            }, 1000);
        });
    }

    async cleanupInstance(sessionName, instanceId, status) {
        try {
            console.log(`🧹 [${sessionName}] Limpando instância, status: ${status}`);

            // Atualizar banco
            await WhatsAppInstance.findByIdAndUpdate(instanceId, {
                status: status,
                qrCode: null,
                ...(status === 'disconnected' && { lastConnection: new Date() })
            });

            // Limpar recursos
            const socket = this.sockets.get(sessionName);
            if (socket) {
                await socket.end();
                this.sockets.delete(sessionName);
            }

            this.authStates.delete(sessionName);
            this.reconnectionAttempts.delete(sessionName);

        } catch (error) {
            console.error(`❌ [${sessionName}] Erro no cleanup:`, error);
        }
    }

    async disconnectClient(sessionName) {
        try {
            console.log(`🔌 [WhatsAppService] Desconectando: ${sessionName}`);

            const socket = this.sockets.get(sessionName);
            if (socket) {
                await socket.logout();
                await socket.end();

                this.sockets.delete(sessionName);
                this.authStates.delete(sessionName);
                this.reconnectionAttempts.delete(sessionName);
            }

            // Atualizar banco
            await WhatsAppInstance.findOneAndUpdate(
                { sessionName },
                {
                    status: 'disconnected',
                    qrCode: null,
                    lastConnection: new Date()
                }
            );

            console.log(`✅ [WhatsAppService] Desconectado: ${sessionName}`);

        } catch (error) {
            console.error(`❌ [WhatsAppService] Erro ao desconectar:`, error);
            throw error;
        }
    }

    async loadGroupsFromWhatsApp(sessionName, userId) {
        try {
            const socket = this.sockets.get(sessionName);
            if (!socket) {
                throw new Error('Instância não encontrada ou não conectada');
            }

            console.log(`📞 [${sessionName}] Buscando grupos...`);

            const groups = await socket.groupFetchAllParticipating();

            let groupCount = 0;
            const instanceId = await this.getInstanceIdBySessionName(sessionName);

            console.log(`📊 [${sessionName}] Encontrados ${Object.keys(groups).length} grupos no WhatsApp`);




            for (const [jid, group] of Object.entries(groups)) {
                try {
                    const groupName = group.subject || 'Sem nome';
                    const groupDescription = group.desc || '';
                    const participants = group.participants || [];
                    const participantCount = participants.length;

                    console.log(`💾 [${sessionName}] Salvando grupo: ${groupName} (${participantCount} participantes)`);

                    // Extrair contatos dos participantes
                    const contacts = this.extractParticipantsAsContacts(participants);

                    console.log(`👥 [${sessionName}] Extraídos ${contacts.length} contatos do grupo ${groupName}`);

                    // Preparar dados do grupo
                    const groupData = {
                        name: groupName,
                        description: groupDescription,
                        contacts: contacts,
                        contactCount: contacts.length,
                        participantCount: participantCount,
                        jid: jid,
                        source: 'whatsapp',
                        whatsappInstanceId: instanceId
                    };

                    await ContactGroup.findOneAndUpdate(
                        {
                            userId: userId,
                            jid: jid,
                            source: 'whatsapp'
                        },
                        groupData,
                        {
                            upsert: true,
                            new: true,
                            runValidators: false // Desativar temporariamente para debug
                        }
                    );

                    groupCount++;
                    console.log(`✅ [${sessionName}] Grupo salvo: ${groupName} com ${contacts.length} contatos`);

                } catch (groupError) {
                    console.error(`❌ [${sessionName}] Erro ao salvar grupo:`, groupError.message);
                    // Log mais detalhado
                    console.log('🔍 Dados do grupo que causaram erro:', {
                        name: group.subject,
                        participantCount: group.participants?.length,
                        jid: jid
                    });
                }
            }

            console.log(`✅ [${sessionName}] ${groupCount} grupos carregados com sucesso`);
            return groupCount;

        } catch (error) {
            console.error(`❌ [${sessionName}] Erro ao carregar grupos:`, error);
            throw error;
        }
    }

    async recreateInstance(sessionName, userId) {
        try {
            console.log(`🔄 [WhatsAppService] Recriando instância: ${sessionName}`);

            // Buscar instância no banco apenas pelo sessionName
            // Ignoramos o userId se não for um ObjectId válido
            let query = { sessionName };

            // Verificar se userId é um ObjectId válido (24 caracteres hexadecimais)
            if (userId && typeof userId === 'string' && /^[0-9a-fA-F]{24}$/.test(userId)) {
                query.userId = userId;
            } else {
                console.log(`⚠️ [${sessionName}] userId inválido ignorado: ${userId}`);
            }

            const instance = await WhatsAppInstance.findOne(query);

            if (!instance) {
                throw new Error('Instância não encontrada no banco');
            }

            // Limpar socket existente se houver
            const existingSocket = this.sockets.get(sessionName);
            if (existingSocket) {
                try {
                    await existingSocket.end();
                } catch (endError) {
                    console.log(`⚠️ Erro ao finalizar socket existente:`, endError.message);
                }
                this.sockets.delete(sessionName);
            }

            // Limpar outros registros
            this.authStates.delete(sessionName);
            this.reconnectionAttempts.delete(sessionName);

            // Recriar a instância do zero
            await this.initializeClient(sessionName, userId, instance._id);

            console.log(`✅ [WhatsAppService] Instância recriada: ${sessionName}`);
            return true;

        } catch (error) {
            console.error(`❌ [WhatsAppService] Erro ao recriar instância:`, error);
            throw error;
        }
    }


    async debugGroupParticipants(sessionName, groupJid) {
        try {
            const socket = this.sockets.get(sessionName);
            if (!socket) {
                throw new Error('Socket não encontrado');
            }

            const group = await socket.groupMetadata(groupJid);
            console.log('🔍 Debug - Participantes do grupo:');
            console.log('Nome:', group.subject);
            console.log('Total de participantes:', group.participants.length);

            group.participants.forEach((participant, index) => {
                console.log(`Participante ${index + 1}:`, {
                    id: participant.id,
                    admin: participant.admin,
                    name: participant.name || 'Sem nome'
                });
            });

            return group.participants;
        } catch (error) {
            console.error('❌ Erro no debug:', error);
            throw error;
        }
    }

    extractParticipantsAsContacts(participants) {

        if (!participants || !Array.isArray(participants)) {
            return [];
        }

        return participants.map(participant => {
            if (!participant || !participant.id) {
                return null;
            }

            try {
                // Extrair informações do participante
                const whatsappId = participant.id;

                // Determinar se é número de telefone ou ID do LinkedIn
                let phone, name;

                if (whatsappId.endsWith('@s.whatsapp.net')) {
                    // É número de telefone
                    phone = whatsappId.replace('@s.whatsapp.net', '');
                    name = participant.name || participant.notify || phone || 'Contato';
                } else if (whatsappId.endsWith('@lid')) {
                    // É ID do LinkedIn
                    phone = whatsappId.replace('@lid', '');
                    name = participant.name || participant.notify || `User-${phone.substring(0, 8)}` || 'Contato';
                } else {
                    // Formato desconhecido
                    phone = whatsappId;
                    name = participant.name || participant.notify || 'Contato';
                }

                // Converter isAdmin para boolean
                const isAdmin = !!(participant.admin ||
                    participant.admin === 'admin' ||
                    participant.admin === 'superadmin');

                return {
                    name: name.substring(0, 50), // Limitar tamanho
                    phone: phone,
                    whatsappId: whatsappId,
                    isAdmin: isAdmin,
                    customFields: new Map()
                };
            } catch (error) {
                console.error('❌ Erro ao processar participante:', error);
                return null;
            }
        }).filter(contact => contact !== null);
    }

    async getInstanceIdBySessionName(sessionName) {
        try {
            const instance = await WhatsAppInstance.findOne({ sessionName });
            return instance ? instance._id : null;
        } catch (error) {
            console.error(`❌ Erro ao buscar ID da instância:`, error);
            return null;
        }
    }

    async getSocketBySessionName(sessionName) {
        const socket = this.sockets.get(sessionName);

        if (!socket) {
            console.log(`❌ [WhatsAppService] Socket não encontrado para: ${sessionName}`);
            console.log(`📋 Sockets disponíveis:`, Array.from(this.sockets.keys()));
            return null;
        }

        if (!socket.user) {
            console.log(`❌ [WhatsAppService] Socket encontrado mas não autenticado: ${sessionName}`);
            return null;
        }

        // Verificar se o socket tem o método sendMessage
        if (typeof socket.sendMessage !== 'function') {
            console.log(`❌ [WhatsAppService] Socket não tem método sendMessage: ${sessionName}`);
            console.log(`🔍 Métodos disponíveis no socket:`, Object.keys(socket).filter(key => typeof socket[key] === 'function'));
            return null;
        }

        console.log(`✅ [WhatsAppService] Socket válido encontrado para: ${sessionName}`);
        return socket;
    }

    async isConnected(sessionName) {
        const socket = this.sockets.get(sessionName);
        return socket && socket.user ? true : false;
    }

    async getInstanceStatus(sessionName) {
        try {
            const instance = await WhatsAppInstance.findOne({ sessionName });
            return instance ? instance.status : 'not_found';
        } catch (error) {
            console.error(`❌ Erro ao buscar status:`, error);
            return 'error';
        }
    }

    // Método para enviar mensagens (opcional, para uso futuro)
    async sendMessage(sessionName, jid, message) {
        try {
            const socket = this.sockets.get(sessionName);
            if (!socket) {
                throw new Error('Instância não encontrada ou não conectada');
            }

            const result = await socket.sendMessage(jid, { text: message });
            console.log(`✅ [${sessionName}] Mensagem enviada para ${jid}`);
            return result;

        } catch (error) {
            console.error(`❌ [${sessionName}] Erro ao enviar mensagem:`, error);
            throw error;
        }
    }

    async sendMediaToContact(sessionName, jid, mediaItem, caption = '', options = {}) {
        console.log(`📤 [${sessionName}] Enviando mídia para: ${jid}`);
        console.log(`📦 Mídia:`, {
            originalName: mediaItem.originalName,
            mimeType: mediaItem.mimeType,
            url: mediaItem.url
        });
        console.log(`📝 Opções:`, options);
        console.log(`🖋️ Legenda:--->`, caption);

        const finalCaption = options.caption || caption || '';


        console.log(`📄 Detalhes da mídia:`, {
            fileName: mediaItem.originalName,
            mimeType: mediaItem.mimeType,
            caption: finalCaption || '(sem legenda)',
            hasCaption: !!finalCaption
        })

        // Verificar estado da conexão
        const connectionState = this.connectionStates.get(sessionName);
        if (connectionState !== 'connected') {
            throw new Error(`Instância não está conectada. Estado: ${connectionState}`);
        }

        const socket = this.sockets.get(sessionName);
        if (!socket || !socket.user) {
            throw new Error('Socket não disponível ou não autenticado');
        }

        // Formatar JID
        let formattedJid = jid;
        if (!jid.includes('@')) {
            const phone = jid.replace(/\D/g, '');
            formattedJid = `${phone}@s.whatsapp.net`;
        }


        // Preparar a mídia baseada no tipo
        let messageOptions = {};
        const mediaUrl = `http://localhost:3000${mediaItem.url}`; // URL completa

        console.log(`🖼️ [${sessionName}] Preparando mídia do tipo: ${mediaItem.mimeType}`);

        if (mediaItem.mimeType.startsWith('image/')) {
            messageOptions = {
                image: { url: mediaUrl },
                caption: finalCaption, // ← USAR finalCaption
                mimetype: mediaItem.mimeType
            };
        } else if (mediaItem.mimeType.startsWith('video/')) {
            messageOptions = {
                video: { url: mediaUrl },
                caption: finalCaption,
                mimetype: mediaItem.mimeType
            };
        } else if (mediaItem.mimeType.startsWith('audio/')) {
            messageOptions = {
                audio: { url: mediaUrl },
                mimetype: mediaItem.mimeType,
                ptt: false
            };
        } else {
            // Documento ou outros tipos
            messageOptions = {
                document: { url: mediaUrl },
                caption: finalCaption,
                mimetype: mediaItem.mimeType,
                fileName: mediaItem.originalName
            };
        }

        // Se for para enviar como documento, forçar tipo
        if (options.sendAsDocument) {
            messageOptions = {
                document: {
                    url: mediaUrl
                },
                caption: finalCaption,
                mimetype: mediaItem.mimeType,
                fileName: mediaItem.originalName
            };
        }

        console.log(`🚀 [${sessionName}] Enviando mídia para: ${formattedJid}`, {
            type: Object.keys(messageOptions)[0],
            hasCaption: !!finalCaption,
            fileName: mediaItem.originalName
        });

        // Enviar a mensagem
        const result = await socket.sendMessage(formattedJid, messageOptions);

        console.log(`✅ [${sessionName}] Mídia enviada com sucesso para: ${formattedJid}`, {
            messageId: result.key?.id,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            messageId: result.key?.id,
            timestamp: new Date()
        };

    } catch(error) {
        console.error(`❌ [${sessionName}] Erro ao enviar mídia para ${jid}:`, error.message);

        // Se for erro de conexão, marcar como desconectado
        if (error.message.includes('not connected') ||
            error.message.includes('socket') ||
            error.message.includes('connection') ||
            error.message.includes('timeout')) {
            this.connectionStates.set(sessionName, 'disconnected');
        }

        return {
            success: false,
            error: error.message
        };
    }



    // FUNÇÃO DE ENVIO SIMPLIFICADA E ROBUSTA
    async sendMessageToContact(sessionName, jid, message) {
        console.log(`📤 [${sessionName}] Preparando envio para: ${jid}`);

        // Verificar estado da conexão
        const connectionState = this.connectionStates.get(sessionName);
        if (connectionState !== 'connected') {
            throw new Error(`Instância não está conectada. Estado: ${connectionState}`);
        }

        const socket = this.sockets.get(sessionName);
        if (!socket || !socket.user) {
            throw new Error('Socket não disponível ou não autenticado');
        }

        try {
            // Formatar JID
            let formattedJid = jid;
            if (!jid.includes('@')) {
                const phone = jid.replace(/\D/g, '');
                formattedJid = `${phone}@s.whatsapp.net`;
            }

            console.log(`🚀 [${sessionName}] Enviando mensagem para: ${formattedJid}`);

            // Envio direto sem verificações complexas
            const result = await socket.sendMessage(formattedJid, { text: message });

            console.log(`✅ [${sessionName}] Mensagem enviada com sucesso para: ${formattedJid}`);
            return result;

        } catch (error) {
            console.error(`❌ [${sessionName}] Erro ao enviar para ${jid}:`, error.message);

            // Se for erro de conexão, marcar como desconectado
            if (error.message.includes('not connected') || error.message.includes('socket') || error.message.includes('connection')) {
                this.connectionStates.set(sessionName, 'disconnected');
            }

            throw error;
        }
    }

    async debugSocket(sessionName) {
        console.log(`🔍 [DEBUG] Analisando socket: ${sessionName}`);

        const socket = this.sockets.get(sessionName);

        if (!socket) {
            console.log(`❌ Socket não encontrado na sessão: ${sessionName}`);
            console.log(`📋 Sockets disponíveis:`, Array.from(this.sockets.keys()));
            return;
        }

        console.log(`✅ Socket encontrado para: ${sessionName}`);
        console.log(`👤 Usuário autenticado:`, socket.user ? 'Sim' : 'Não');
        console.log(`📞 Métodos disponíveis:`, Object.keys(socket).filter(key => typeof socket[key] === 'function'));
        console.log(`🔗 Estado da conexão:`, socket.ws ? 'WebSocket conectado' : 'WebSocket não conectado');

        // Testar método sendMessage
        if (typeof socket.sendMessage === 'function') {
            console.log(`✅ Método sendMessage disponível`);
        } else {
            console.log(`❌ Método sendMessage NÃO disponível`);
        }

        return socket;
    }

    // Método para buscar todos os sockets ativos
    getActiveSockets() {
        const activeSockets = {};
        for (const [sessionName, socket] of this.sockets.entries()) {
            activeSockets[sessionName] = {
                connected: !!socket.user,
                user: socket.user ? socket.user.id : null
            };
        }
        return activeSockets;
    }

    // Método para forçar limpeza de todas as instâncias
    async cleanupAllInstances() {
        try {
            console.log('🧹 [WhatsAppService] Limpando todas as instâncias...');

            for (const [sessionName, socket] of this.sockets.entries()) {
                try {
                    await socket.end();
                } catch (error) {
                    console.error(`❌ Erro ao limpar socket ${sessionName}:`, error);
                }
            }

            this.sockets.clear();
            this.authStates.clear();
            this.reconnectionAttempts.clear();

            console.log('✅ [WhatsAppService] Todas as instâncias limpas');

        } catch (error) {
            console.error('❌ [WhatsAppService] Erro na limpeza geral:', error);
        }
    }
    // services/whatsappService.js - ADICIONE ESTA FUNÇÃO:

    async reconnectInstance(sessionName, userId) {
        try {
            console.log(`🔄 [WhatsAppService] Tentando reconectar: ${sessionName}`);

            // Buscar instância no banco
            const instance = await WhatsAppInstance.findOne({
                sessionName,
                userId
            });

            if (!instance) {
                throw new Error('Instância não encontrada no banco');
            }

            // Limpar socket existente se houver
            const existingSocket = this.sockets.get(sessionName);
            if (existingSocket) {
                await existingSocket.end();
                this.sockets.delete(sessionName);
            }

            // Recriar a instância
            await this.initializeClient(sessionName, userId, instance._id);

            console.log(`✅ [WhatsAppService] Reconexão iniciada para: ${sessionName}`);
            return true;

        } catch (error) {
            console.error(`❌ [WhatsAppService] Erro na reconexão:`, error);
            throw error;
        }
    }


    async disconnectClient(sessionName) {
        try {
            console.log(`🔌 [WhatsAppService] Desconectando: ${sessionName}`);
            await this.cleanupInstance(sessionName, null, 'disconnected');
            console.log(`✅ [WhatsAppService] Desconectado: ${sessionName}`);
        } catch (error) {
            console.error(`❌ [WhatsAppService] Erro ao desconectar:`, error);
            throw error;
        }
    }

    // Reconexão segura
    async safeReconnect(sessionName, userId, instanceId) {
        try {
            if (this.initializingInstances.has(sessionName)) {
                console.log(`⚠️ [${sessionName}] Já está reconectando, ignorando...`);
                return;
            }

            console.log(`🔄 [${sessionName}] Iniciando reconexão segura...`);

            // Limpar socket existente
            const existingSocket = this.sockets.get(sessionName);
            if (existingSocket) {
                try {
                    await existingSocket.end();
                } catch (err) {
                    console.log(`⚠️ [${sessionName}] Erro ao finalizar socket: ${err.message}`);
                }
                this.sockets.delete(sessionName);
            }

            // Recriar instância
            await this.initializeClient(sessionName, userId, instanceId);

            console.log(`✅ [${sessionName}] Reconexão segura concluída`);

        } catch (error) {
            console.error(`❌ [${sessionName}] Erro na reconexão segura:`, error);
            this.connectionStates.set(sessionName, 'failed');
        }
    }

    async recreateInstance(sessionName, userId) {
        return this.safeReconnect(sessionName, userId, null);
    }

    async getSocketStatus(sessionName) {
        const socket = this.sockets.get(sessionName);
        const connectionState = this.connectionStates.get(sessionName);

        return {
            connected: connectionState === 'connected',
            connectionState: connectionState,
            hasSocket: !!socket,
            hasUser: !!(socket && socket.user)
        };
    }



    // 📝 ATUALIZE o método loadContactsWithDetails no whatsappService.js

    async loadContactsWithDetails(sessionName, userId, instanceId) {
        try {
            const socket = this.sockets.get(sessionName);
            if (!socket) {
                throw new Error('Instância não conectada');
            }

            console.log(`📞 [${sessionName}] Coletando contatos com detalhes completos...`);

            // Buscar todos os contatos
            const contacts = await socket.getContacts();
            console.log(`📊 [${sessionName}] ${contacts.length} contatos brutos encontrados`);

            const enrichedContacts = [];
            const batchSize = 3; // Reduzido para evitar bloqueio
            let processed = 0;

            for (let i = 0; i < contacts.length; i += batchSize) {
                const batch = contacts.slice(i, i + batchSize);
                console.log(`🔄 [${sessionName}] Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(contacts.length / batchSize)}`);

                // Processar cada contato individualmente
                for (const contact of batch) {
                    try {
                        // Pular contatos inválidos ou grupos
                        if (!contact.id ||
                            contact.id.server === 'g.us' ||
                            contact.id.server === 'broadcast' ||
                            !contact.id._serialized) {
                            continue;
                        }

                        // ✅ USAR O NOVO MÉTODO DE PROCESSAMENTO INDIVIDUAL
                        const enrichedContact = await this.processIndividualContact(
                            sessionName,
                            contact.id._serialized
                        );

                        if (enrichedContact) {
                            enrichedContacts.push(enrichedContact);
                            processed++;

                            console.log(`✅ [${sessionName}] ${processed}/${contacts.length} - ${enrichedContact.name}`);
                        }

                    } catch (contactError) {
                        console.warn(`⚠️ [${sessionName}] Erro no contato ${contact.id?._serialized}:`, contactError.message);
                    }
                }

                // Delay maior entre lotes para evitar bloqueio
                console.log(`⏳ [${sessionName}] Aguardando 3 segundos...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            console.log(`🎉 [${sessionName}] Processamento concluído: ${enrichedContacts.length} contatos enriquecidos`);

            // Salvar no banco
            const contactGroup = await ContactGroup.findOneAndUpdate(
                {
                    userId: userId,
                    name: `Contatos ${sessionName}`,
                    source: 'whatsapp'
                },
                {
                    userId: userId,
                    name: `Contatos ${sessionName}`,
                    description: `Contatos completos da instância ${sessionName}`,
                    contacts: enrichedContacts,
                    source: 'whatsapp',
                    whatsappInstanceId: instanceId,
                    contactCount: enrichedContacts.length,
                    syncStatus: 'completed',
                    lastSync: new Date(),
                    metadata: {
                        totalFound: contacts.length,
                        successfullyProcessed: enrichedContacts.length,
                        hasProfilePictures: enrichedContacts.filter(c => c.profilePicture).length,
                        businessAccounts: enrichedContacts.filter(c => c.isBusiness).length
                    }
                },
                {
                    upsert: true,
                    new: true
                }
            );

            console.log(`💾 [${sessionName}] Contatos salvos no grupo: ${contactGroup._id}`);

            return {
                success: true,
                totalContacts: contacts.length,
                processedContacts: enrichedContacts.length,
                groupId: contactGroup._id
            };

        } catch (error) {
            console.error(`❌ [${sessionName}] Erro ao carregar contatos com detalhes:`, error);
            throw error;
        }
    }

    /**
 * Processa um contato individualmente com todas as informações disponíveis
 */
    async processIndividualContact(sessionName, contactId) {
        try {
            console.log(`🔍 [${sessionName}] Processando contato individual: ${contactId}`);

            const socket = this.sockets.get(sessionName);
            if (!socket) {
                throw new Error('Socket não disponível');
            }

            // 1. Buscar informações básicas do contato
            const contact = await socket.getContact(contactId);
            if (!contact) {
                console.log(`⚠️ [${sessionName}] Contato não encontrado: ${contactId}`);
                return null;
            }

            // 2. Coletar informações adicionais em paralelo
            const [profilePicture, status, lastSeen] = await Promise.allSettled([
                this.getProfilePicture(sessionName, contactId),
                this.getStatus(sessionName, contactId),
                this.getLastSeen(sessionName, contactId)
            ]).then(results => results.map(result =>
                result.status === 'fulfilled' ? result.value : null
            ));

            // 3. Estruturar dados completos do contato
            const contactData = {
                // Informações básicas
                name: contact.name || contact.pushname || contact.verifiedName || '',
                pushName: contact.pushname || '',
                shortName: contact.shortName || '',

                // Identificação
                phone: contact.id.user,
                whatsappId: contact.id._serialized,

                // Informações de perfil
                profilePicture: profilePicture || '',
                status: status || '',
                lastSeen: lastSeen,

                // Informações de negócio
                isBusiness: contact.business || false,
                businessName: contact.businessName || '',
                businessCategory: contact.businessCategory || '',
                verified: contact.verified || false,

                // Metadados
                isGroup: contact.id.server === 'g.us',
                platform: 'whatsapp',
                syncDate: new Date()
            };

            console.log(`✅ [${sessionName}] Contato processado: ${contactData.name} (${contactData.phone})`);

            return contactData;

        } catch (error) {
            console.error(`❌ [${sessionName}] Erro ao processar contato ${contactId}:`, error.message);
            return null;
        }
    }

    /**
     * Busca foto de perfil do contato
     */
    async getProfilePicture(sessionName, contactId) {
        try {
            const socket = this.sockets.get(sessionName);
            if (!socket) return null;

            const profilePic = await socket.getProfilePicture(contactId);
            return profilePic || null;
        } catch (error) {
            // Foto não disponível é comum, não logar como erro
            return null;
        }
    }

    /**
     * Busca status do contato
     */
    async getStatus(sessionName, contactId) {
        try {
            const socket = this.sockets.get(sessionName);
            if (!socket) return null;

            const status = await socket.getStatus(contactId);
            return status || '';
        } catch (error) {
            return null;
        }
    }

    /**
     * Busca último visto do contato
     */
    async getLastSeen(sessionName, contactId) {
        try {
            const socket = this.sockets.get(sessionName);
            if (!socket) return null;

            // Em alguns casos, o lastSeen vem no próprio contato
            const contact = await socket.getContact(contactId);
            return contact.lastSeen ? new Date(contact.lastSeen * 1000) : null;
        } catch (error) {
            return null;
        }
    }

    // ✅ NOVO: Método para debug de contatos
    async debugContacts(sessionName) {
        try {
            const socket = this.sockets.get(sessionName);
            if (!socket) {
                throw new Error('Socket não encontrado');
            }

            console.log(`🔍 [DEBUG] Analisando contatos para: ${sessionName}`);

            const contacts = await socket.getContacts();
            console.log(`📞 Total de contatos: ${contacts.length}`);

            if (contacts.length > 0) {
                const sampleContact = contacts[0];
                console.log('📋 ESTRUTURA DO CONTATO:', {
                    id: sampleContact.id,
                    name: sampleContact.name,
                    notify: sampleContact.notify,
                    verifiedName: sampleContact.verifiedName,
                    business: sampleContact.business,
                    businessName: sampleContact.businessName,
                    verified: sampleContact.verified
                });

                // Testar métodos
                try {
                    const profilePic = await socket.getProfilePicture(sampleContact.id._serialized);
                    console.log('🖼️ Foto disponível:', !!profilePic);
                } catch (error) {
                    console.log('🖼️ Foto:', error.message);
                }

                try {
                    const status = await socket.getStatus(sampleContact.id._serialized);
                    console.log('📝 Status disponível:', !!status);
                } catch (error) {
                    console.log('📝 Status:', error.message);
                }
            }

            return contacts.length;
        } catch (error) {
            console.error('❌ Erro no debug:', error);
            throw error;
        }
    }
}
// Exportar singleton
module.exports = new WhatsAppService();