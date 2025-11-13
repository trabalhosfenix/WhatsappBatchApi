// js/tarefas.js
class TarefasManager {
    constructor() {
        this.tarefas = [];
        this.filtroAtual = 'todas';
        this.lembreteAtual = null;
        this.intervalos = {
            checkLembretes: null,
            atualizarLista: null
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.carregarTarefas();
        this.iniciarCheckLembretes();

        // Atualizar a cada 30 segundos
        this.intervalos.atualizarLista = setInterval(() => {
            this.carregarTarefas();
        }, 30000);
    }

    setupEventListeners() {
        // Botão nova tarefa
        document.getElementById('addTarefaBtn').addEventListener('click', () => {
            this.abrirModal();
        });

        // Formulário tarefa
        document.getElementById('tarefaForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarTarefa();
        });

        // Filtros rápidos
        document.querySelectorAll('.filtro-rapido').forEach(filtro => {
            filtro.addEventListener('click', (e) => {
                this.aplicarFiltroRapido(e.target.dataset.filtro);
            });
        });

        // Filtros avançados
        document.getElementById('filterStatus').addEventListener('change', () => {
            this.aplicarFiltros();
        });

        document.getElementById('filterPrioridade').addEventListener('change', () => {
            this.aplicarFiltros();
        });

        // Busca
        document.getElementById('searchTarefas').addEventListener('input', () => {
            this.aplicarFiltros();
        });

        // Fechar modal
        document.querySelector('#tarefaModal .close').addEventListener('click', () => {
            this.fecharModal();
        });
    }

    async carregarTarefas() {
        try {
            const response = await fetch('/api/tarefas', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.tarefas = data.tarefas;
                this.renderTarefas();
                this.atualizarContadores();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Erro ao carregar tarefas:', error);
            this.showNotification('Erro ao carregar tarefas', 'error');
        }
    }

    renderTarefas(tarefasFiltradas = null) {
        const container = document.getElementById('tarefasList');
        const tarefas = tarefasFiltradas || this.tarefas;

        if (!tarefas || tarefas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks fa-3x"></i>
                    <h3>Nenhuma tarefa encontrada</h3>
                    <p>Comece criando sua primeira tarefa ou lembrete</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tarefas.map(tarefa => `
            <div class="list-item tarefa-card priority-${tarefa.prioridade}">
                <div class="list-item-info">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <h4>${this.escapeHtml(tarefa.titulo)}</h4>
                        <div style="display: flex; gap: 5px;">
                            <span class="priority-badge priority-${tarefa.prioridade}">
                                ${this.getPrioridadeText(tarefa.prioridade)}
                            </span>
                            <span class="status-badge status-${tarefa.status}">
                                ${this.getStatusText(tarefa.status)}
                            </span>
                        </div>
                    </div>
                    
                    ${tarefa.descricao ? `<p>${this.escapeHtml(tarefa.descricao)}</p>` : ''}
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <div>
                            <small>
                                <i class="far fa-calendar"></i> 
                                ${this.formatarDataHora(tarefa.dataHora)}
                                ${tarefa.categoria ? ` | ${this.escapeHtml(tarefa.categoria)}` : ''}
                                ${tarefa.tags && tarefa.tags.length > 0 ? ` | ${tarefa.tags.map(tag => `#${tag}`).join(' ')}` : ''}
                            </small>
                        </div>
                        <div class="list-item-actions">
                            ${tarefa.status !== 'concluida' ? `
                                <button class="btn btn-success btn-sm" onclick="tarefasManager.marcarConcluida('${tarefa._id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-secondary btn-sm" onclick="tarefasManager.editarTarefa('${tarefa._id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="tarefasManager.excluirTarefa('${tarefa._id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    aplicarFiltroRapido(filtro) {
        this.filtroAtual = filtro;

        // Atualizar UI dos filtros
        document.querySelectorAll('.filtro-rapido').forEach(f => {
            f.classList.toggle('active', f.dataset.filtro === filtro);
        });

        this.aplicarFiltros();
    }

    aplicarFiltros() {
        let tarefasFiltradas = [...this.tarefas];
        const busca = document.getElementById('searchTarefas').value.toLowerCase();
        const filtroStatus = document.getElementById('filterStatus').value;
        const filtroPrioridade = document.getElementById('filterPrioridade').value;

        // Aplicar filtro rápido
        switch (this.filtroAtual) {
            case 'hoje':
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const amanha = new Date(hoje);
                amanha.setDate(amanha.getDate() + 1);

                tarefasFiltradas = tarefasFiltradas.filter(t => {
                    const dataTarefa = new Date(t.dataHora);
                    return dataTarefa >= hoje && dataTarefa < amanha;
                });
                break;

            case 'pendentes':
                tarefasFiltradas = tarefasFiltradas.filter(t =>
                    t.status === 'pendente' || t.status === 'em_andamento'
                );
                break;

            case 'alta':
                tarefasFiltradas = tarefasFiltradas.filter(t =>
                    t.prioridade === 'alta' || t.prioridade === 'urgente'
                );
                break;

            case 'lembretes':
                tarefasFiltradas = tarefasFiltradas.filter(t =>
                    t.tipo === 'lembrete'
                );
                break;
        }

        // Aplicar filtros avançados
        if (filtroStatus) {
            tarefasFiltradas = tarefasFiltradas.filter(t => t.status === filtroStatus);
        }

        if (filtroPrioridade) {
            tarefasFiltradas = tarefasFiltradas.filter(t => t.prioridade === filtroPrioridade);
        }

        // Aplicar busca
        if (busca) {
            tarefasFiltradas = tarefasFiltradas.filter(t =>
                t.titulo.toLowerCase().includes(busca) ||
                (t.descricao && t.descricao.toLowerCase().includes(busca)) ||
                (t.categoria && t.categoria.toLowerCase().includes(busca)) ||
                (t.tags && t.tags.some(tag => tag.toLowerCase().includes(busca)))
            );
        }

        this.renderTarefas(tarefasFiltradas);
    }

    async abrirModal(tarefa = null) {
        this.tarefaAtual = tarefa;
        const modal = document.getElementById('tarefaModal');
        const title = document.getElementById('modalTarefaTitle');

        if (tarefa) {
            title.textContent = 'Editar Tarefa';
            this.preencherForm(tarefa);
        } else {
            title.textContent = 'Nova Tarefa';
            this.limparForm();
        }

        modal.style.display = 'block';
    }

    fecharModal() {
        document.getElementById('tarefaModal').style.display = 'none';
        this.tarefaAtual = null;
    }

    preencherForm(tarefa) {
        document.getElementById('tarefaTitulo').value = tarefa.titulo;
        document.getElementById('tarefaDescricao').value = tarefa.descricao || '';
        document.getElementById('tarefaTipo').value = tarefa.tipo;
        document.getElementById('tarefaPrioridade').value = tarefa.prioridade;
        document.getElementById('tarefaDataHora').value = this.formatarDataHoraInput(tarefa.dataHora);
        document.getElementById('tarefaNotificar').value = tarefa.notificarAntes;
        document.getElementById('tarefaRepetir').value = tarefa.repetir;
        document.getElementById('tarefaCategoria').value = tarefa.categoria || '';
        document.getElementById('tarefaTags').value = tarefa.tags ? tarefa.tags.join(', ') : '';
    }

    limparForm() {
        document.getElementById('tarefaForm').reset();
        // Set default values
        document.getElementById('tarefaDataHora').value = this.formatarDataHoraInput(new Date());
        document.getElementById('tarefaPrioridade').value = 'media';
        document.getElementById('tarefaTipo').value = 'tarefa';
    }

    async salvarTarefa() {
        const formData = {
            titulo: document.getElementById('tarefaTitulo').value,
            descricao: document.getElementById('tarefaDescricao').value,
            tipo: document.getElementById('tarefaTipo').value,
            prioridade: document.getElementById('tarefaPrioridade').value,
            dataHora: document.getElementById('tarefaDataHora').value,
            notificarAntes: parseInt(document.getElementById('tarefaNotificar').value) || 15,
            repetir: document.getElementById('tarefaRepetir').value,
            categoria: document.getElementById('tarefaCategoria').value,
            tags: document.getElementById('tarefaTags').value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0)
        };

        // ✅ CORREÇÃO: Validar e formatar data/hora antes de enviar
        if (formData.dataHora) {
            const dataInput = document.getElementById('tarefaDataHora');
            const dataSelecionada = new Date(dataInput.value);

            // ✅ GARANTIR que usa o timezone local corretamente
            // O input datetime-local já envia no formato YYYY-MM-DDTHH:MM
            // O backend vai interpretar corretamente com a correção acima

            console.log('📅 Data enviada para backend:', {
                inputValue: dataInput.value,
                jsDate: dataSelecionada,
                isoString: dataSelecionada.toISOString(),
                localString: dataSelecionada.toLocaleString('pt-BR')
            });
        }

        try {
            let response;
            if (this.tarefaAtual) {
                response = await fetch(`/api/tarefas/${this.tarefaAtual._id}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
            } else {
                response = await fetch('/api/tarefas', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
            }

            const data = await response.json();

            if (data.success) {
                this.showNotification(
                    this.tarefaAtual ? 'Tarefa atualizada com sucesso!' : 'Tarefa criada com sucesso!',
                    'success'
                );
                this.fecharModal();
                this.carregarTarefas();

                // ✅ DEBUG: Mostrar data salva
                console.log('✅ Tarefa salva com data:', {
                    dataSalva: data.tarefa.dataHora,
                    dataLocal: new Date(data.tarefa.dataHora).toLocaleString('pt-BR')
                });
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async editarTarefa(tarefaId) {
        const tarefa = this.tarefas.find(t => t._id === tarefaId);
        if (tarefa) {
            this.abrirModal(tarefa);
        }
    }

    async marcarConcluida(tarefaId) {
        try {
            const response = await fetch(`/api/tarefas/${tarefaId}/status`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ status: 'concluida' })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Tarefa marcada como concluída!', 'success');
                this.carregarTarefas();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async excluirTarefa(tarefaId) {
        if (!confirm('Tem certeza que deseja excluir esta tarefa?')) {
            return;
        }

        try {
            const response = await fetch(`/api/tarefas/${tarefaId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Tarefa excluída com sucesso!', 'success');
                this.carregarTarefas();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    // Sistema de Lembretes
    iniciarCheckLembretes() {
        this.intervalos.checkLembretes = setInterval(() => {
            this.verificarLembretes();
        }, 60000); // Verificar a cada minuto

        // Verificar imediatamente ao carregar
        this.verificarLembretes();
    }

    async verificarLembretes() {
        try {
            const response = await fetch('/api/tarefas/lembretes/pendentes', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success && data.lembretes.length > 0) {
                // Mostrar apenas o primeiro lembrete por vez
                const lembrete = data.lembretes[0];
                if (!this.lembreteAtual || this.lembreteAtual._id !== lembrete._id) {
                    this.mostrarPopupLembrete(lembrete);
                }
            }
        } catch (error) {
            console.error('Erro ao verificar lembretes:', error);
        }
    }

    mostrarPopupLembrete(lembrete) {
        this.lembreteAtual = lembrete;

        document.getElementById('popupTitulo').textContent = lembrete.titulo;
        document.getElementById('popupDescricao').textContent = lembrete.descricao || 'Sem descrição';
        document.getElementById('popupDataHora').textContent = `Para: ${this.formatarDataHora(lembrete.dataHora)}`;

        document.getElementById('popupLembrete').style.display = 'block';

        // Auto-fechar após 30 segundos se não interagir
        setTimeout(() => {
            if (this.lembreteAtual && this.lembreteAtual._id === lembrete._id) {
                this.marcarPopupComoVisto(lembrete._id);
            }
        }, 30000);
    }

    fecharPopup() {
        document.getElementById('popupLembrete').style.display = 'none';
        this.lembreteAtual = null;
    }

    async marcarComoVisto() {
        if (this.lembreteAtual) {
            await this.marcarPopupComoVisto(this.lembreteAtual._id);
        }
        this.fecharPopup();
    }

    async adiarLembrete() {
        if (this.lembreteAtual) {
            // Adiar por 5 minutos
            const novaData = new Date(this.lembreteAtual.dataHora);
            novaData.setMinutes(novaData.getMinutes() + 5);

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
                    this.showNotification('Lembrete adiado por 5 minutos', 'info');
                    this.fecharPopup();
                    this.carregarTarefas();
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

    // Utilitários
    atualizarContadores() {
        const total = this.tarefas.length;
        const pendentes = this.tarefas.filter(t => t.status === 'pendente').length;
        const andamento = this.tarefas.filter(t => t.status === 'em_andamento').length;
        const concluidas = this.tarefas.filter(t => t.status === 'concluida').length;

        document.getElementById('contadorTotal').textContent = total;
        document.getElementById('contadorPendentes').textContent = `${pendentes} pendentes`;
        document.getElementById('contadorAndamento').textContent = `${andamento} em andamento`;
        document.getElementById('contadorConcluidas').textContent = `${concluidas} concluídas`;
    }

    getPrioridadeText(prioridade) {
        const map = {
            'baixa': 'Baixa',
            'media': 'Média',
            'alta': 'Alta',
            'urgente': 'Urgente'
        };
        return map[prioridade] || prioridade;
    }

    getStatusText(status) {
        const map = {
            'pendente': 'Pendente',
            'em_andamento': 'Em Andamento',
            'concluida': 'Concluída',
            'cancelada': 'Cancelada'
        };
        return map[status] || status;
    }

    formatarDataHora(dataString) {
        return new Date(dataString).toLocaleString('pt-BR');
    }

    formatarDataHoraInput(dataString) {
        const date = new Date(dataString);
        return date.toISOString().slice(0, 16);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    showNotification(message, type = 'success') {
        // Usar o sistema de notificação existente
        if (window.app && window.app.auth) {
            window.app.auth.showNotification(message, type);
        } else {
            alert(`${type}: ${message}`);
        }
    }

    destroy() {
        // Limpar intervalos
        Object.values(this.intervalos).forEach(interval => {
            if (interval) clearInterval(interval);
        });
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.tarefasManager = new TarefasManager();
});