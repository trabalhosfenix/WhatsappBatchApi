// Fila para processar mensagens sequencialmente
const messageQueue = []
let isProcessing = false

// Timeouts específicos por tipo de comando
const COMMAND_TIMEOUTS = {
    // Comandos de download (precisam de mais tempo)
    'play': 120000,    // 2 minutos
    'yt': 120000,      // 2 minutos
    'video': 120000,   // 2 minutos
    'musica': 120000,  // 2 minutos
    
    // Comandos de IA/processamento pesado
    'gpt': 60000,      // 1 minuto
    'ai': 60000,
    'ia': 60000,
    'imagine': 90000,  // 1.5 minuto
    
    // Comandos de mídia
    'sticker': 45000,  // 45 segundos
    's': 45000,
    'figurinha': 45000,
    
    // Comandos básicos (rápidos)
    'default': 25000   // 25 segundos
}

function getTimeoutForCommand(commandName) {
    return COMMAND_TIMEOUTS[commandName] || COMMAND_TIMEOUTS.default
}

async function processQueue() {
    if (isProcessing || messageQueue.length === 0) return
    
    isProcessing = true
    const { sock, msg } = messageQueue.shift()
    
    try {
        await processSingleMessage(sock, msg)
    } catch (error) {
        console.error("❌ Erro na fila de mensagens:", error)
    } finally {
        isProcessing = false
        // Processa próxima mensagem após pequeno delay
        if (messageQueue.length > 0) {
            setTimeout(processQueue, 100)
        }
    }
}

async function processSingleMessage(sock, msg) {
    const from = msg.key.remoteJid
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""

    if (!text.startsWith("#")) return

    // Extrai o nome do comando
    const commandName = text.substring(1).trim().split(' ')[0].toLowerCase()
    const timeoutMs = getTimeoutForCommand(commandName)

    console.log(`🎯 Comando recebido de ${from}: ${text} (timeout: ${timeoutMs/1000}s)`)

    try {
        // Timeout dinâmico baseado no tipo de comando
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout no comando #${commandName} (${timeoutMs/1000}s)`)), timeoutMs)
        })
        
        await Promise.race([
            processCommand(sock, from, text, msg),
            timeoutPromise
        ])
        
        console.log(`✅ Comando #${commandName} executado com sucesso`)
        
    } catch (error) {
        console.error(`❌ Erro ao processar comando #${commandName}:`, error.message)
        
        // Não envia mensagem de erro para timeouts de comandos longos
        // (o download pode continuar em background)
        if (!error.message.includes('Timeout')) {
            try {
                await sock.sendMessage(from, { 
                    text: `❌ Erro ao executar comando #${commandName}: ${error.message}` 
                })
            } catch (sendError) {
                console.error("❌ Erro ao enviar mensagem de erro:", sendError)
            }
        } else {
            console.log(`⏳ Comando #${commandName} em processamento (timeout ignorado)`)
        }
    }
}

export async function processMessage(sock, msg) {
    // Adiciona à fila e processa assincronamente
    messageQueue.push({ sock, msg })
    processQueue()
}

// Função para verificar o estado da fila (para debug)
export function getQueueStatus() {
    return {
        queueLength: messageQueue.length,
        isProcessing: isProcessing
    }
}