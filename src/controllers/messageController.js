// src/controllers/messageController.js
// import { processMessage } from '../services/messageService.js'




export async function handleMessage(sock, msg) {
    try {
        // Verificações básicas
        if (!msg.message) return
        
        const from = msg.key.remoteJid
        const to = msg.key.participant || from
        const text = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || ""

        
        
    
        // if (msg.key.fromMe ) {
        //     return
        // }

        // Verifica se é comando OU se tem mídia com comando na legenda
        const hasMedia = msg.message?.imageMessage || msg.message?.videoMessage
        const hasCommand = text.startsWith('#')
        
        if (hasCommand || (hasMedia && text.startsWith('#'))) {
            console.log(`📩 Mensagem de ${from}: ${text || '[Mídia com comando]'}`)     
            console.log(`📩 Mensagem de ${from}: ${text || '[Mídia com comando]'} , para ${to}`)       
        } 
        // await processMessage(sock, msg)
        if (hasCommand) {
        console.log(`📩 Mensagem de ${from}: ${text || '[Mídia com comando]'} , para ${to}`) 
            // transformar obj msg em string
            let msgStr = JSON.stringify(msg)
        console.log(`debug: ${msgStr}`)
        }

    } catch (error) {
        console.error("Erro no handleMessage:", error)
    }
}