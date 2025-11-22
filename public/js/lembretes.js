// 📁 js/lembretes.js - SISTEMA DE LEMBRETES PERSISTENTES
class LembretesManager {
    constructor() {
        this.lembreteAtual = null;
        this.popupVisivel = false;
        this.intervalos = {
            checkLembretes: null,
            persistenciaPopup: null
        };
        this.init();
    }

    init() {
        this.iniciarCheckLembretes();
        this.criarPopupGlobal();
        
        // ✅ SOLICITAR PERMISSÃO DE NOTIFICAÇÃO
        this.solicitarPermissaoNotificacao();
    }

    // ✅ SISTEMA PERSISTENTE DE LEMBRETES
    iniciarCheckLembretes() {
        this.intervalos.checkLembretes = setInterval(() => {
            this.verificarLembretes();
        }, 30000); // Verificar a cada 30 segundos
        
        // ✅ VERIFICAR LEMBRETES PENDENTES AO INICIAR
        this.verificarLembretes();
        
        // ✅ MANTER POPUP VISÍVEL SE NÃO FECHADO
        this.intervalos.persistenciaPopup = setInterval(() => {
            if (this.popupVisivel && this.lembreteAtual) {
                this.manterPopupVisivel();
            }
        }, 10000); // Verificar a cada 10 segundos
    }

    async verificarLembretes() {
        try {
            const response = await fetch('/api/tarefas/lembretes/pendentes', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success && data.lembretes.length > 0) {
                const lembrete = data.lembretes[0];
                
                // ✅ SEMPRE MOSTRAR POPUP SE HÁ LEMBRETES PENDENTES
                if (!this.lembreteAtual || this.lembreteAtual._id !== lembrete._id) {
                    this.mostrarPopupLembrete(lembrete);
                    
                }
            } else if (this.popupVisivel) {
                // ✅ SE NÃO HÁ LEMBRETES E POPUP ESTÁ VISÍVEL, FECHAR
                this.fecharPopup();
            }
        } catch (error) {
            console.error('Erro ao verificar lembretes:', error);
        }
    }

    mostrarPopupLembrete(lembrete) {
        this.lembreteAtual = lembrete;
        this.popupVisivel = true;
        
        // ✅ CRIAR/MOSTRAR POPUP
        this.criarOuAtualizarPopup(lembrete);
        
        // ✅ NOTIFICAÇÃO DO NAVEGADOR (OPCIONAL)
        this.notificarNavegador(lembrete);
        
        console.log('🔔 Lembrete persistente ativado:', lembrete.titulo);
    }

    criarPopupGlobal() {
        // ✅ VERIFICAR SE JÁ EXISTE PARA NÃO DUPLICAR
        if (document.getElementById('popupLembreteGlobal')) {
            return;
        }

        const popupHTML = `
            <div id="popupLembreteGlobal" class="popup-lembrete-global" style="display: none;">
                <div class="popup-header">
                    <h4><i class="fas fa-bell"></i> Lembrete Importante</h4>
                    <div>
                        <button class="btn btn-sm btn-secondary" onclick="window.lembretesManager.minimizarPopup()">
                            <i class="fas fa-window-minimize"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="window.lembretesManager.fecharPopup()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="popup-content">
                    <h5 id="popupGlobalTitulo"></h5>
                    <p id="popupGlobalDescricao"></p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <small id="popupGlobalDataHora"></small>
                        <span id="popupGlobalPrioridade" class="priority-badge"></span>
                    </div>
                </div>
                <div class="popup-actions">
                    <button class="btn btn-secondary" id="popupGlobalAdiar">
                        <i class="fas fa-clock"></i> Adiar 10min
                    </button>
                    <button class="btn btn-primary" id="popupGlobalVisto">
                        <i class="fas fa-check"></i> Marcar como Visto
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', popupHTML);
        
        // ✅ CONFIGURAR EVENT LISTENERS
        const btnAdiar = document.getElementById('popupGlobalAdiar');
        const btnVisto = document.getElementById('popupGlobalVisto');
        
        if (btnAdiar) {
            btnAdiar.onclick = () => this.adiarLembrete();
        }
        if (btnVisto) {
            btnVisto.onclick = () => this.marcarComoVisto();
        }
    }

    criarOuAtualizarPopup(lembrete) {
        let popup = document.getElementById('popupLembreteGlobal');
        
        if (!popup) {
            popup = this.criarPopupGlobal();
        }
        
        // ✅ ATUALIZAR CONTEÚDO
        document.getElementById('popupGlobalTitulo').textContent = lembrete.titulo;
        document.getElementById('popupGlobalDescricao').textContent = lembrete.descricao || 'Sem descrição';
        document.getElementById('popupGlobalDataHora').textContent = `Para: ${this.formatarDataHora(lembrete.dataHora)}`;
        document.getElementById('popupGlobalPrioridade').textContent = this.getPrioridadeText(lembrete.prioridade);
        document.getElementById('popupGlobalPrioridade').className = `priority-badge priority-${lembrete.prioridade}`;
        
        // ✅ APLICAR CLASSE DE PRIORIDADE NO POPUP
        popup.className = `popup-lembrete-global priority-${lembrete.prioridade}`;
        
        // ✅ GARANTIR QUE ESTÁ VISÍVEL
        popup.style.display = 'block';
        this.popupVisivel = true;
    }

    // ✅ MANTER POPUP SEMPRE VISÍVEL
    manterPopupVisivel() {
        const popup = document.getElementById('popupLembreteGlobal');
        if (popup && this.lembreteAtual) {
            // ✅ TRAZER PARA FRENTE E GARANTIR VISIBILIDADE
            popup.style.zIndex = '9999';
            popup.style.display = 'block';
            
            // ✅ PISCAR SUAVEMENTE PARA CHAMAR ATENÇÃO (OPCIONAL)
            if (!popup.classList.contains('piscando')) {
                popup.classList.add('piscando');
                setTimeout(() => popup.classList.remove('piscando'), 1000);
            }
        }
    }

    minimizarPopup() {
        const popup = document.getElementById('popupLembreteGlobal');
        if (popup) {
            popup.style.display = 'none';
            this.popupVisivel = false;
            
            // ✅ REABRIR APÓS 2 MINUTOS SE AINDA HOUVER LEMBRETE
            setTimeout(() => {
                if (this.lembreteAtual) {
                    this.mostrarPopupLembrete(this.lembreteAtual);
                }
            }, 120000);
        }
    }

    async marcarComoVisto() {
        if (this.lembreteAtual) {
            await this.marcarPopupComoVisto(this.lembreteAtual._id);
        }
        this.fecharPopup();
    }

    async adiarLembrete() {
        if (this.lembreteAtual) {
            // ✅ ADIAR POR 10 MINUTOS
            const novaData = new Date();
            novaData.setMinutes(novaData.getMinutes() + 10);
            
            try {
                const response = await fetch(`/api/tarefas/${this.lembreteAtual._id}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ 
                        dataHora: novaData.toISOString(),
                        popupMostrado: false 
                    })
                });

                if (response.ok) {
                    this.mostrarNotificacao('Lembrete adiado por 10 minutos', 'info');
                    this.fecharPopup();
                }
            } catch (error) {
                console.error('Erro ao adiar lembrete:', error);
            }
        }
    }

    async marcarPopupComoVisto(tarefaId) {
        try {
            await fetch(`/api/tarefas/${tarefaId}/marcar-popup`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
        } catch (error) {
            console.error('Erro ao marcar popup como visto:', error);
        }
    }

    fecharPopup() {
        const popup = document.getElementById('popupLembreteGlobal');
        if (popup) {
            popup.style.display = 'none';
        }
        this.popupVisivel = false;
        this.lembreteAtual = null;
    }

    // ✅ NOTIFICAÇÃO DO NAVEGADOR (BÔNUS)
    notificarNavegador(lembrete) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🔔 Lembrete: ' + lembrete.titulo, {
                body: lembrete.descricao || 'Clique para ver detalhes',
                icon: '/favicon.ico',
                tag: 'lembrete-' + lembrete._id
            });
        }
    }

    // ✅ SOLICITAR PERMISSÃO DE NOTIFICAÇÃO
    solicitarPermissaoNotificacao() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // ✅ UTILITÁRIOS
    getPrioridadeText(prioridade) {
        const map = {
            'baixa': 'Baixa',
            'media': 'Média',
            'alta': 'Alta',
            'urgente': 'Urgente'
        };
        return map[prioridade] || prioridade;
    }

    formatarDataHora(dataString) {
        return new Date(dataString).toLocaleString('pt-BR');
    }

    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    mostrarNotificacao(message, type = 'info') {
        // Usar sistema de notificação existente se disponível
        if (window.app && window.app.auth && window.app.auth.showNotification) {
            window.app.auth.showNotification(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }

    destroy() {
        // Limpar todos os intervalos
        Object.values(this.intervalos).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        this.fecharPopup();
    }
}

// ✅ INICIALIZAR EM TODAS AS PÁGINAS
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se usuário está logado
    const token = localStorage.getItem('authToken');
    if (token) {
        window.lembretesManager = new LembretesManager();
    }
});