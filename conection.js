// test-connection.js
import makeWASocket, { useMultiFileAuthState, Browsers, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";

async function testBaileysConnection() {
    console.log('🚀 Iniciando teste do Baileys...');
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState("./test_auth");
        console.log('✅ Auth state carregado');

        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: "debug" }),
            printQRInTerminal: true,
            browser: Browsers.macOS("Desktop"),
            version: [2, 3001, 101],
            connectTimeoutMs: 30000,
            retryRequestDelayMs: 3000,
        });

        sock.ev.on("creds.update", saveCreds);
        
        sock.ev.on("connection.update", (update) => {
            console.log('\n🔌 CONNECTION UPDATE:');
            console.log('Connection:', update.connection);
            console.log('QR:', update.qr ? 'SIM' : 'NÃO');
            
            const { connection, qr, lastDisconnect } = update;
            
            if (qr) {
                console.log('\n📱 QR CODE GERADO:');
                qrcode.generate(qr, { small: true });
                
                // ✅ Também salva o QR em arquivo para debug
                const fs = require('fs');
                fs.writeFileSync('./qrcode.txt', qr);
                console.log('QR salvo em ./qrcode.txt');
            }
            
            if (connection === "open") {
                console.log('\n✅ CONECTADO COM SUCESSO!');
                console.log('User ID:', sock.user?.id);
                console.log('User Name:', sock.user?.name);
                
                // Mantém a conexão por um tempo
                setTimeout(() => {
                    console.log('Teste concluído com sucesso!');
                    process.exit(0);
                }, 5000);
            }
            
            if (connection === "close") {
                console.log('\n❌ CONEXÃO FECHADA:');
                console.log('Last Disconnect:', lastDisconnect?.error);
                
                if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                    console.log('⚠️ Sessão expirada - recriando...');
                    // Recria a conexão
                    setTimeout(testBaileysConnection, 3000);
                }
            }
        });

        // Evento específico de QR (algumas versões usam isso)
        sock.ev.on("qr", (qr) => {
            console.log('\n🎯 QR EVENT RECEBIDO:');
            qrcode.generate(qr, { small: true });
        });

        console.log('🕐 Aguardando conexão...');

    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error);
        process.exit(1);
    }
}

// Executa o teste
testBaileysConnection();

// Mantém o processo vivo
setInterval(() => {}, 1000);