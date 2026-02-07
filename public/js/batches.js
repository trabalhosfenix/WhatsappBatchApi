class Batches {
    constructor() {
        this.currentBatch = null;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add batch button
        const addBatchBtn = document.getElementById('addBatchBtn');
        if (addBatchBtn) {
            addBatchBtn.addEventListener('click', () => {
                this.openBatchModal();
            });
        }

        // Batch form submission
        const batchForm = document.getElementById('batchForm');
        if (batchForm) {
            batchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveBatch();
            });
        }

        // Modal close
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                if (e.target.closest('#batchModal')) {
                    this.closeBatchModal();
                }
            });
        });
    }

    async loadBatches() {
        try {
            if (!authInstance) {
                console.error('Auth instance not available');
                return;
            }

            authInstance.showLoading();
            const response = await fetch('/api/batches', {
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.renderBatches(data.batches);
            } else {
                throw new Error(data.error || 'Erro ao carregar lotes');
            }
        } catch (error) {
            if (authInstance) {
                authInstance.showNotification(error.message, 'error');
            }
            this.renderBatches([]);
        } finally {
            if (authInstance) {
                authInstance.hideLoading();
            }
        }
    }

    renderBatches(batches) {
        const container = document.getElementById('batchesList');
        if (!container) return;

        if (!batches || batches.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-paper-plane fa-3x"></i>
                    <h3>Nenhum lote encontrado</h3>
                    <p>Comece criando seu primeiro envio em lote</p>
                </div>
            `;
            return;
        }

        container.innerHTML = batches.map(batch => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${batch.name}</h4>
                    <p>${batch.message}</p>
                    <p>
                        Status: 
                        <span class="status-badge status-${batch.status}">
                            ${this.getStatusText(batch.status)}
                        </span>
                    </p>
                    <div class="progress-info">
                        <small>
                            Progresso: ${batch.sent || 0}/${batch.totalContacts || 0} mensagens
                            ${batch.failed ? ` (${batch.failed} falhas)` : ''}
                        </small>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${this.calculateProgress(batch)}%"></div>
                        </div>
                    </div>
                    <small>
                        Instância: ${batch.whatsappInstance?.sessionName || 'N/A'} | 
                        Grupos: ${batch.contactGroups?.length || 0} | 
                        Criado em: ${this.formatDate(batch.createdAt)}
                    </small>
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-info" onclick="app.batches.viewBatch('${batch._id}')">
                        <i class="fas fa-eye"></i> Detalhes
                    </button>
                    ${batch.status === 'pending' || batch.status === 'processing' ? `
                        <button class="btn btn-warning" onclick="app.batches.cancelBatch('${batch._id}')">
                            <i class="fas fa-stop"></i> Cancelar
                        </button>
                    ` : ''}
                    <button class="btn btn-danger" onclick="app.batches.deleteBatch('${batch._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pendente',
            'processing': 'Processando',
            'completed': 'Concluído',
            'failed': 'Falhou',
            'cancelled': 'Cancelado'
        };
        return statusMap[status] || status;
    }

    calculateProgress(batch) {
        if (!batch.totalContacts || batch.totalContacts === 0) return 0;
        const sent = batch.sent || 0;
        return Math.round((sent / batch.totalContacts) * 100);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('pt-BR');
    }

    async openBatchModal() {
        try {
            const [instancesResponse, groupsResponse] = await Promise.all([
                fetch('/api/whatsapp/instances', { headers: authInstance.getAuthHeaders() }),
                fetch('/api/contact-groups?limit=100', { headers: authInstance.getAuthHeaders() })
            ]);

            const instancesData = await instancesResponse.json();
            const groupsData = await groupsResponse.json();

            if (!instancesData.success || !groupsData.success) {
                throw new Error('Erro ao carregar dados para criar lote');
            }

            const connectedInstances = (instancesData.instances || []).filter(i => i.status === 'connected');

            const instancesWithSocket = await Promise.all(
                connectedInstances.map(async (instance) => {
                    try {
                        const res = await fetch(`/api/whatsapp/instances/${instance._id}`, {
                            headers: authInstance.getAuthHeaders()
                        });
                        const data = await res.json();
                        return data.success ? instance : null;
                    } catch {
                        return null;
                    }
                })
            );

            const availableInstances = instancesWithSocket.filter(Boolean);
            const groups = groupsData.contactGroups || [];

            if (availableInstances.length === 0) {
                authInstance.showNotification('Nenhuma instância disponível.', 'warning');
                return;
            }

            if (groups.length === 0) {
                authInstance.showNotification('Nenhum grupo de contatos disponível.', 'warning');
                return;
            }

            this.showBatchModal(availableInstances, groups);
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        }
    }


    showBatchModal(instances, groups) {
        // Criar modal dinamicamente se não existir
        let modal = document.getElementById('batchModal');
        if (!modal) {
            modal = this.createBatchModal();
        }

        // Popular selects
        const instanceSelect = document.getElementById('batchInstance');
        const groupsSelect = document.getElementById('batchGroups');

        if (instanceSelect) {
            instanceSelect.innerHTML = instances.map(instance =>
                `<option value="${instance._id}">${instance.sessionName} (${instance.phoneNumber})</option>`
            ).join('');
        }

        if (groupsSelect) {
            groupsSelect.innerHTML = groups.map(group =>
                `<option value="${group._id}">${group.name} (${group.contactCount} contatos)</option>`
            ).join('');
        }

        modal.style.display = 'block';
    }

    createBatchModal() {
        const modalHTML = `
            <div id="batchModal" class="modal">
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h3>Novo Envio em Lote</h3>
                    <form id="batchForm">
                        <div class="form-group">
                            <label for="batchName">Nome do Lote:</label>
                            <input type="text" id="batchName" placeholder="Ex: Promoção Verão" required>
                        </div>
                        <div class="form-group">
                            <label for="batchMessage">Mensagem:</label>
                            <textarea id="batchMessage" rows="6" placeholder="Digite sua mensagem aqui..." required></textarea>
                            <small class="char-count">0/1000 caracteres</small>
                        </div>
                        <div class="form-group">
                            <label for="batchInstance">Instância WhatsApp:</label>
                            <select id="batchInstance" required>
                                <option value="">Selecione uma instância</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="batchGroups">Grupos de Contatos:</label>
                            <select id="batchGroups" multiple required style="height: 120px;">
                            </select>
                            <small>Segure Ctrl para selecionar múltiplos grupos</small>
                        </div>
                        <div class="form-group">
                            <label for="batchDelay">Delay entre mensagens (ms):</label>
                            <input type="number" id="batchDelay" value="1000" min="500" max="60000">
                        </div>
                        <button type="submit" class="btn btn-primary">Iniciar Envio</button>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Configurar event listeners do novo modal
        const messageTextarea = document.getElementById('batchMessage');
        if (messageTextarea) {
            messageTextarea.addEventListener('input', this.updateCharCount);
        }

        const closeBtn = document.querySelector('#batchModal .close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeBatchModal();
            });
        }

        const form = document.getElementById('batchForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveBatch();
            });
        }

        return document.getElementById('batchModal');
    }

    updateCharCount() {
        const textarea = document.getElementById('batchMessage');
        const charCount = document.querySelector('.char-count');
        if (textarea && charCount) {
            const count = textarea.value.length;
            charCount.textContent = `${count}/1000 caracteres`;
            if (count > 1000) {
                charCount.style.color = 'red';
            } else {
                charCount.style.color = '#666';
            }
        }
    }

    closeBatchModal() {
        const modal = document.getElementById('batchModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentBatch = null;
    }

    async saveBatch() {
        const nameInput = document.getElementById('batchName');
        const messageInput = document.getElementById('batchMessage');
        const instanceSelect = document.getElementById('batchInstance');
        const groupsSelect = document.getElementById('batchGroups');
        const delayInput = document.getElementById('batchDelay');

        if (!nameInput || !messageInput || !instanceSelect || !groupsSelect || !authInstance) {
            return;
        }

        const name = nameInput.value.trim();
        const message = messageInput.value.trim();
        const whatsappInstanceId = instanceSelect.value;
        const selectedGroups = Array.from(groupsSelect.selectedOptions).map(option => option.value);
        const delay = parseInt(delayInput?.value) || 1000;

        if (!name || !message || !whatsappInstanceId || selectedGroups.length === 0) {
            authInstance.showNotification('Preencha todos os campos obrigatórios', 'warning');
            return;
        }

        if (message.length > 1000) {
            authInstance.showNotification('A mensagem deve ter no máximo 1000 caracteres', 'warning');
            return;
        }

        try {
            authInstance.showLoading();

            const response = await fetch('/api/batches', {
                method: 'POST',
                headers: authInstance.getAuthHeaders(),
                body: JSON.stringify({
                    name,
                    message,
                    contactGroupIds: selectedGroups,
                    whatsappInstanceId,
                    options: {
                        delayBetweenMessages: delay
                    }
                })
            });

            const data = await response.json();

            if (data.success) {
                authInstance.showNotification('Lote criado e envio iniciado!', 'success');
                this.closeBatchModal();
                this.loadBatches();

                // Atualizar automaticamente o progresso
                this.startBatchProgressCheck(data.batch._id);
            } else {
                throw new Error(data.error || 'Erro ao criar lote');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    startBatchProgressCheck(batchId) {
        const checkInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/batches/${batchId}`, {
                    headers: authInstance.getAuthHeaders()
                });

                const data = await response.json();

                if (data.success) {
                    const batch = data.batch;

                    // Atualizar a lista se o batch estiver visível
                    this.loadBatches();

                    // Parar de verificar se o batch foi finalizado
                    if (['completed', 'failed', 'cancelled'].includes(batch.status)) {
                        clearInterval(checkInterval);
                        authInstance.showNotification(`Lote "${batch.name}" finalizado!`, 'success');
                    }
                }
            } catch (error) {
                console.error('Erro ao verificar progresso do lote:', error);
            }
        }, 3000);
    }

    async viewBatch(batchId) {
        try {
            if (!authInstance) return;

            authInstance.showLoading();
            const response = await fetch(`/api/batches/${batchId}`, {
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showBatchDetailsModal(data.batch);
            } else {
                throw new Error(data.error || 'Erro ao carregar lote');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    showBatchDetailsModal(batch) {
        // Criar modal de detalhes
        const modalHTML = `
            <div id="batchDetailsModal" class="modal">
                <div class="modal-content" style="max-width: 800px;">
                    <span class="close">&times;</span>
                    <h3>Detalhes do Lote: ${batch.name}</h3>
                    
                    <div class="batch-info">
                        <p><strong>Status:</strong> <span class="status-badge status-${batch.status}">${this.getStatusText(batch.status)}</span></p>
                        <p><strong>Mensagem:</strong> ${batch.message}</p>
                        <p><strong>Progresso:</strong> ${batch.progress.sent}/${batch.progress.total} (${batch.progress.failed} falhas)</p>
                        <p><strong>Instância:</strong> ${batch.whatsappInstance?.sessionName}</p>
                        <p><strong>Grupos:</strong> ${batch.contactGroups?.map(g => g.name).join(', ')}</p>
                    </div>

                    <div class="results-section">
                        <h4>Resultados do Envio</h4>
                        <div class="results-list" style="max-height: 400px; overflow-y: auto;">
                            ${batch.results && batch.results.length > 0 ?
                batch.results.map(result => `
                                    <div class="result-item ${result.status}">
                                        <strong>${result.contact}</strong> (${result.phone}) - 
                                        <span class="status-${result.status}">${result.status === 'sent' ? '✅' : '❌'} ${result.status}</span>
                                        ${result.error ? `<br><small>Erro: ${result.error}</small>` : ''}
                                        <br><small>Grupo: ${result.group} | ${new Date(result.timestamp).toLocaleString('pt-BR')}</small>
                                    </div>
                                `).join('') :
                '<p>Nenhum resultado disponível</p>'
            }
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal anterior se existir
        const existingModal = document.getElementById('batchDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('batchDetailsModal');
        const closeBtn = modal.querySelector('.close');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.style.display = 'block';
    }

    async cancelBatch(batchId) {
        if (!confirm('Tem certeza que deseja cancelar este lote?') || !authInstance) {
            return;
        }

        try {
            authInstance.showLoading();
            const response = await fetch(`/api/batches/${batchId}/cancel`, {
                method: 'PUT',
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                authInstance.showNotification('Lote cancelado com sucesso!', 'success');
                this.loadBatches();
            } else {
                throw new Error(data.error || 'Erro ao cancelar lote');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    async deleteBatch(batchId) {
        if (!confirm('Tem certeza que deseja excluir este lote?') || !authInstance) {
            return;
        }

        try {
            authInstance.showLoading();
            const response = await fetch(`/api/batches/${batchId}`, {
                method: 'DELETE',
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                authInstance.showNotification('Lote excluído com sucesso!', 'success');
                this.loadBatches();
            } else {
                throw new Error(data.error || 'Erro ao excluir lote');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }
}