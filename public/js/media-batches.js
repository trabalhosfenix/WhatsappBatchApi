class MediaBatchesManager {
    constructor(app) {
        this.app = app;
        this.uploadedFiles = [];
        this.currentModal = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.pollingInterval = null;
        this.activeBatches = new Set(); // Para controlar batches ativos
        console.log('✅ MediaBatchesManager inicializado');
    }

    initEvents() {
        console.log('🎯 Inicializando eventos do MediaBatchesManager...');

        const button = document.getElementById('newMediaBatchBtn');
        console.log('🔍 Procurando pelo botão "Novo Envio de Mídia":', button);

        if (button) {
            button.addEventListener('click', () => {
                console.log('🎪 CLIQUE DETECTADO! Chamando showMediaBatchModal...');
                this.showMediaBatchModal();
            });
        } else {
            console.error('❌ Botão "newMediaBatchBtn" não encontrado!');
        }

        // Carregar lotes de mídia quando a página carregar
        this.loadMediaBatches();

        // Adicionar evento para paginação
        this.setupPaginationEvents();

        // Adicionar event delegation para os botões dos batches
        this.setupBatchEvents();

        // Iniciar polling para atualização em tempo real
        this.startProgressPolling();

        // Configurar limpeza ao fechar página
        window.addEventListener('beforeunload', () => this.destroy());
    }

    setupBatchEvents() {
        // Usar event delegation para lidar com cliques nos batches
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Encontrar o botão clicado ou seu pai
            const button = target.closest('button');
            if (!button) return;

            // Verificar se é um botão de ação do batch
            const batchCard = button.closest('.batch-card');
            if (!batchCard) return;

            const batchId = batchCard.dataset.batchId;
            if (!batchId) return;

            // Determinar qual ação foi clicada
            if (button.textContent.includes('Reutilizar') || button.querySelector('.fa-recycle')) {
                e.preventDefault();
                this.reuseBatch(batchId);
            } else if (button.textContent.includes('Detalhes') || button.querySelector('.fa-eye')) {
                e.preventDefault();
                this.viewBatchDetails(batchId);
            } else if (button.textContent.includes('Excluir') || button.querySelector('.fa-trash')) {
                e.preventDefault();
                this.deleteBatch(batchId);
            } else if (button.textContent.includes('Cancelar') || button.querySelector('.fa-stop')) {
                e.preventDefault();
                this.cancelBatch(batchId);
            }
        });
    }

    startProgressPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(() => {
            this.updateBatchesProgress();
        }, 5000); // Atualiza a cada 5 segundos
    }

    async updateBatchesProgress() {
        try {
            // const response = await this.safeApiRequest('GET', `/api/media/batches?page=${this.currentPage}&limit=10`);

            if (response.success && response.batches?.length > 0) {
                this.updateBatchCardsProgress(response.batches);
            }
        } catch (error) {
            console.warn('⚠️ Erro ao atualizar progresso:', error);
        }
    }

    renderPagination() {
        const container = document.getElementById('mediaBatchesList');
        if (!container || this.totalPages <= 1) return;

        let paginationHTML = '<div class="pagination">';

        // Botão anterior
        if (this.currentPage > 1) {
            paginationHTML += `<button class="page-btn btn btn-secondary" data-page="${this.currentPage - 1}">
                <i class="fas fa-chevron-left"></i> Anterior
            </button>`;
        }

        // Páginas
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === 1 || i === this.totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `<button class="page-btn btn ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}" data-page="${i}">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }

        // Botão próximo
        if (this.currentPage < this.totalPages) {
            paginationHTML += `<button class="page-btn btn btn-secondary" data-page="${this.currentPage + 1}">
                Próximo <i class="fas fa-chevron-right"></i>
            </button>`;
        }

        paginationHTML += '</div>';
        container.insertAdjacentHTML('beforeend', paginationHTML);
    }

    async loadMediaBatches(page = 1) {
        try {
            const container = document.getElementById('mediaBatchesList');
            if (!container) return;

            container.innerHTML = '<div class="loading-text">Carregando lotes de mídia...</div>';
            const response = await this.safeApiRequest('GET', `/api/media/batches?page=${page}&limit=10`);

            if (response.success && response.batches && response.batches.length > 0) {
                this.currentPage = page;
                this.totalPages = response.pagination?.pages || 1;

                // Atualizar batches ativos
                this.updateActiveBatches(response.batches);

                container.innerHTML = this.renderMediaBatchesList(response.batches);
                this.renderPagination();

                console.log(`✅ ${response.batches.length} lotes carregados`);
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-images"></i>
                        <p>Nenhum lote de mídia encontrado</p>
                        <button class="btn btn-primary" id="createFirstBatchBtn">
                            <i class="fas fa-plus"></i> Criar Primeiro Lote
                        </button>
                    </div>
                `;

                document.getElementById('createFirstBatchBtn')?.addEventListener('click', () => {
                    this.showMediaBatchModal();
                });
            }
        } catch (error) {
            console.error('Erro ao carregar lotes de mídia:', error);
            const container = document.getElementById('mediaBatchesList');
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erro ao carregar lotes de mídia</p>
                        <button class="btn btn-secondary" onclick="app.mediaBatchesManager.loadMediaBatches()">
                            <i class="fas fa-redo"></i> Tentar Novamente
                        </button>
                    </div>
                `;
            }
        }
    }

    // ✅ NOVO: Atualizar batches ativos para polling eficiente
    updateActiveBatches(batches) {
        this.activeBatches.clear();
        batches.forEach(batch => {
            if (this.isBatchActive(batch.status)) {
                this.activeBatches.add(batch._id);
            }
        });
        console.log(`📊 Batches ativos: ${this.activeBatches.size}`);
    }

    // ✅ NOVO: Verificar se batch precisa de atualização
    isBatchActive(status) {
        return ['pending', 'processing'].includes(status);
    }

    renderMediaBatchesList(batches) {
        return `
            <div class="batches-grid">
                ${batches.map(batch => `
                    <div class="batch-card" data-batch-id="${batch._id}" data-batch-status="${batch.status}">
                        <div class="batch-header">
                            <h4>${this.escapeHtml(batch.name)}</h4>
                            <span class="batch-status ${batch.status}">
                                ${this.getStatusText(batch.status)}
                                ${batch.status === 'processing' ? '<i class="fas fa-sync fa-spin"></i>' : ''}
                            </span>
                        </div>
                        
                        <div class="batch-info">
                            <div class="info-item">
                                <i class="fas fa-images"></i>
                                <span>${batch.mediaCount || 0} mídia(s)</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-users"></i>
                                <span>${batch.contactGroups ? batch.contactGroups.length : 0} grupo(s)</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-paper-plane"></i>
                                <span class="sent-count">${batch.progress?.sent || 0}/${batch.progress?.total || 0} enviados</span>
                            </div>
                            ${batch.failed > 0 ? `
                                <div class="info-item">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <span class="failed-count">${batch.progress?.failed || 0} falhas</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="batch-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${this.calculateProgress(batch)}%"></div>
                            </div>
                            <span class="progress-text">${this.calculateProgress(batch)}%</span>
                        </div>
                        
                        <div class="batch-meta">
                            <small>Criado em: ${new Date(batch.createdAt).toLocaleString('pt-BR')}</small>
                            ${batch.whatsappInstance ? `
                                <small>Instância: ${batch.whatsappInstance.sessionName}</small>
                            ` : ''}
                        </div>
                        
                        <div class="batch-actions">
                            ${batch.status === 'processing' ? `
                                <button class="btn btn-warning btn-sm batch-action-btn" data-action="cancel" title="Cancelar envio">
                                    <i class="fas fa-stop"></i> Cancelar
                                </button>
                            ` : ''}
                            
                            ${batch.status === 'completed' || batch.status === 'completed_with_errors' ? `
                                <button class="btn btn-success btn-sm batch-action-btn" data-action="reuse" title="Reutilizar este lote">
                                    <i class="fas fa-recycle"></i> Reutilizar
                                </button>
                            ` : ''}
                            
                            <button class="btn btn-info btn-sm batch-action-btn" data-action="view" title="Ver detalhes">
                                <i class="fas fa-eye"></i> Detalhes
                            </button>
                            
                            ${batch.status !== 'processing' ? `
                                <button class="btn btn-danger btn-sm batch-action-btn" data-action="delete" title="Excluir lote">
                                    <i class="fas fa-trash"></i> Excluir
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    calculateProgress(batch) {
        if (!batch.progress || !batch.progress.total || batch.progress.total === 0) {
            return 0;
        }

        const progress = (batch.progress.sent / batch.progress.total) * 100;
        return Math.min(100, Math.max(0, Math.round(progress)));
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pendente',
            'processing': 'Processando',
            'completed': 'Concluído',
            'completed_with_errors': 'Concluído com erros',
            'failed': 'Falhou',
            'cancelled': 'Cancelado',
            'paused_daily_limit': 'Pausado - Limite Diário'
        };
        return statusMap[status] || status;
    }

    // ✅ CORREÇÃO: Método de polling funcionando
    startProgressPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(() => {
            this.updateBatchesProgress();
        }, 3000); // Atualiza a cada 3 segundos (mais rápido para testes)
    }

    // ✅ CORREÇÃO: Método descomentado e melhorado
    async updateBatchesProgress() {
        try {
            // Só atualiza se houver batches ativos
            if (this.activeBatches.size === 0) {
                return;
            }

            const response = await this.safeApiRequest('GET', `/api/media/batches?page=${this.currentPage}&limit=10`);

            if (response.success && response.batches?.length > 0) {
                this.updateActiveBatches(response.batches);
                this.updateBatchCardsProgress(response.batches);
            }
        } catch (error) {
            console.warn('⚠️ Erro ao atualizar progresso:', error);
        }
    }

    // ✅ MELHORIA: Atualização mais eficiente dos cards
    updateBatchCardsProgress(batches) {
        let hasChanges = false;

        batches.forEach(batch => {
            const card = document.querySelector(`.batch-card[data-batch-id="${batch._id}"]`);
            if (!card) return;

            const currentStatus = card.dataset.batchStatus;
            const newStatus = batch.status;

            // Verificar se houve mudança de status
            if (currentStatus !== newStatus) {
                card.dataset.batchStatus = newStatus;
                hasChanges = true;
            }

            // Atualizar elementos do card
            this.updateBatchCardElements(card, batch);
        });

        // Se houve mudanças significativas, recarregar a lista
        if (hasChanges) {
            console.log('🔄 Mudanças detectadas, recarregando lista...');
            setTimeout(() => this.loadMediaBatches(this.currentPage), 1000);
        }
    }

    // ✅ NOVO: Atualizar elementos específicos do card
    updateBatchCardElements(card, batch) {
        // Atualizar status
        const statusSpan = card.querySelector('.batch-status');
        if (statusSpan) {
            statusSpan.className = `batch-status ${batch.status}`;
            statusSpan.innerHTML = `${this.getStatusText(batch.status)} ${batch.status === 'processing' ? '<i class="fas fa-sync fa-spin"></i>' : ''
                }`;
        }

        // Atualizar contadores
        const sentCount = card.querySelector('.sent-count');
        if (sentCount) {
            sentCount.textContent = `${batch.progress?.sent || 0}/${batch.progress?.total || 0} enviados`;
        }

        const failedCount = card.querySelector('.failed-count');
        if (failedCount && batch.progress?.failed > 0) {
            failedCount.textContent = `${batch.progress.failed} falhas`;
        }

        // Atualizar barra de progresso
        const progressFill = card.querySelector('.progress-fill');
        const progressText = card.querySelector('.progress-text');
        const progressPercent = this.calculateProgress(batch);

        if (progressFill) {
            progressFill.style.width = `${progressPercent}%`;
            progressFill.className = `progress-fill ${this.getProgressColorClass(progressPercent)}`;
        }

        if (progressText) {
            progressText.textContent = `${progressPercent}%`;
        }

        // Atualizar ações disponíveis
        this.updateBatchActions(card, batch);
    }

    // ✅ NOVO: Classe de cor baseada no progresso
    getProgressColorClass(progress) {
        if (progress >= 90) return 'progress-high';
        if (progress >= 50) return 'progress-medium';
        return 'progress-low';
    }

    // ✅ NOVO: Atualizar botões de ação dinamicamente
    updateBatchActions(card, batch) {
        const actionsContainer = card.querySelector('.batch-actions');
        if (!actionsContainer) return;

        // Remover botão de cancelar se não estiver mais processando
        if (batch.status !== 'processing') {
            const cancelBtn = actionsContainer.querySelector('[data-action="cancel"]');
            if (cancelBtn) cancelBtn.remove();
        }

        // Adicionar botão de reutilizar se concluído
        if ((batch.status === 'completed' || batch.status === 'completed_with_errors') &&
            !actionsContainer.querySelector('[data-action="reuse"]')) {

            const reuseBtn = document.createElement('button');
            reuseBtn.className = 'btn btn-success btn-sm batch-action-btn';
            reuseBtn.setAttribute('data-action', 'reuse');
            reuseBtn.setAttribute('title', 'Reutilizar este lote');
            reuseBtn.innerHTML = '<i class="fas fa-recycle"></i> Reutilizar';

            // Inserir antes do botão de detalhes
            const viewBtn = actionsContainer.querySelector('[data-action="view"]');
            if (viewBtn) {
                actionsContainer.insertBefore(reuseBtn, viewBtn);
            }
        }
    }

    setupPaginationEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-btn')) {
                e.preventDefault();
                const page = parseInt(e.target.dataset.page);
                if (page && page !== this.currentPage) {
                    this.loadMediaBatches(page);
                }
            }
        });
    }

    renderPagination() {
        const container = document.getElementById('mediaBatchesList');
        if (!container || this.totalPages <= 1) return;

        let paginationHTML = '<div class="pagination">';

        // Botão anterior
        if (this.currentPage > 1) {
            paginationHTML += `
                <button class="page-btn btn btn-secondary" data-page="${this.currentPage - 1}">
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>
            `;
        }

        // Páginas
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === 1 || i === this.totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `
                    <button class="page-btn btn ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}" 
                            data-page="${i}">${i}</button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }

        // Botão próximo
        if (this.currentPage < this.totalPages) {
            paginationHTML += `
                <button class="page-btn btn btn-secondary" data-page="${this.currentPage + 1}">
                    Próximo <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginationHTML += '</div>';
        container.insertAdjacentHTML('beforeend', paginationHTML);
    }

    // ✅ NOVO: Utilitário para escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }







    // Método seguro para chamadas API
    async safeApiRequest(method, endpoint, data = null, isFormData = false) {
        console.log(`🌐 API Request: ${method} ${endpoint}`, data);

        try {
            if (this.app && typeof this.app.apiRequest === 'function') {
                const result = await this.app.apiRequest(method, endpoint, data, isFormData);
                console.log(`✅ API Response via app:`, result);
                return result;
            } else {
                const result = await this.directApiRequest(method, endpoint, data, isFormData);
                console.log(`✅ API Response via direct:`, result);
                return result;
            }
        } catch (error) {
            console.error(`❌ API Error:`, error);
            return { success: false, error: error.message };
        }
    }

    // Fallback direto para requisições API
    async directApiRequest(method, endpoint, data = null, isFormData = false) {
        this.safeShowLoading(true);

        try {
            const options = {
                method: method,
                headers: {}
            };

            if (data) {
                if (isFormData) {
                    options.body = data;
                } else {
                    options.headers['Content-Type'] = 'application/json';
                    options.body = JSON.stringify(data);
                }
            }

            const token = localStorage.getItem('authToken');
            if (token) {
                options.headers['Authorization'] = `Bearer ${token}`;
            }

            console.log(`🔧 Fetch options:`, options);
            const response = await fetch(endpoint, options);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.safeShowLoading(false);
            return result;

        } catch (error) {
            this.safeShowLoading(false);
            console.error('❌ Erro na requisição API direta:', error);
            return { success: false, error: error.message };
        }
    }

    // Método seguro para mostrar notificações
    safeShowNotification(message, type = 'info') {
        if (this.app && typeof this.app.showNotification === 'function') {
            this.app.showNotification(message, type);
        } else {
            // Fallback simples
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    // Método seguro para mostrar loading
    safeShowLoading(show) {
        if (this.app && typeof this.app.showLoading === 'function') {
            this.app.showLoading(show);
        } else {
            const loading = document.getElementById('loading');
            if (loading) {
                loading.style.display = show ? 'flex' : 'none';
            }
        }
    }

    // Método seguro para fechar modal
    safeCloseModal(modalId) {
        console.log(`🔒 Tentando fechar modal: ${modalId}`);

        if (this.app && typeof this.app.closeModal === 'function') {
            this.app.closeModal(modalId);
        } else {
            const modal = document.getElementById(modalId);
            if (modal) {
                console.log(`✅ Modal ${modalId} encontrado, removendo...`);
                modal.remove();
            } else {
                console.log(`⚠️ Modal ${modalId} não encontrado`);
                const openModals = document.querySelectorAll('.modal');
                openModals.forEach(modal => {
                    console.log('🔄 Removendo modal aberto:', modal.id);
                    modal.remove();
                });
            }
        }

        this.currentModal = null;
    }

    async showMediaBatchModal(batchData = null) {
        console.log('▶️ Iniciando showMediaBatchModal...');

        // Fecha qualquer modal anterior
        this.safeCloseModal('mediaBatchModal');

        console.log('▶️ Verificando instâncias conectadas...');
        const instances = await this.getConnectedInstances();
        console.log('📱 Instâncias conectadas encontradas:', instances);

        if (instances.length === 0) {
            this.safeShowNotification('⚠️ É necessário ter uma instância WhatsApp conectada', 'warning');
            console.error('❌ BLOQUEADO: Nenhuma instância do WhatsApp está conectada.');
            return;
        }

        console.log('▶️ Verificando grupos de contatos...');
        const groups = await this.getContactGroups();
        console.log('👥 Grupos de contato encontrados:', groups);

        if (groups.length === 0) {
            this.safeShowNotification('⚠️ É necessário criar grupos de contatos primeiro', 'warning');
            console.error('❌ BLOQUEADO: Nenhum grupo de contatos foi criado.');
            return;
        }

        console.log('✅ SUCESSO: Todas as condições foram atendidas. Criando o modal...');
        this.createMediaBatchModal(batchData);
    }

    createMediaBatchModal(batchData = null) {
        console.log('🎨 Criando modal de envio de mídia...');

        const isEdit = batchData !== null;
        const modalTitle = isEdit ? `Reutilizar Lote: ${batchData.name}` : 'Novo Envio de Mídia em Lote';
        const buttonText = isEdit ? 'Reutilizar Lote' : 'Criar Lote de Mídia';

        // Preparar informações das mídias existentes
        const existingMediaInfo = isEdit ? this.renderExistingMediaInfo(batchData) : '';

        // CORREÇÃO: Usar a legenda do batchData se existir
        const existingCaption = batchData ? (batchData.options.caption || '') : '';

        const modalHTML = `
        <div id="mediaBatchModal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 900px;">
                <span class="close" id="closeMediaBatchModal">&times;</span>
                <h3>${modalTitle}</h3>
                
                <form id="mediaBatchForm">
                    <div class="form-group">
                        <label for="mediaBatchName">Nome do Lote:</label>
                        <input type="text" id="mediaBatchName" placeholder="Ex: Campanha de Natal" value="${batchData ? batchData.name : ''}" required>
                    </div>

                    <div class="form-group">
                        <label for="mediaBatchInstance">Instância WhatsApp:</label>
                        <select id="mediaBatchInstance" required>
                            <option value="">Carregando instâncias...</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Grupos de Contatos:</label>
                        
                        <!-- ✅ BARRA DE PESQUISA -->
                        <div class="search-container">
                            <div class="search-input-wrapper">
                                <i class="fas fa-search"></i>
                                <input type="text" id="groupSearch" placeholder="Buscar grupos por nome..." class="search-input">
                                <span id="searchClear" class="search-clear" style="display: none;">
                                    <i class="fas fa-times"></i>
                                </span>
                            </div>
                            <div class="search-info">
                                <span id="searchResultsCount"></span>
                            </div>
                        </div>

                        <!-- ✅ BADGES DOS GRUPOS SELECIONADOS -->
                        <div id="selectedGroupsBadges" class="selected-groups-badges">
                            <div class="no-groups-selected">Nenhum grupo selecionado</div>
                        </div>

                        <!-- ✅ LISTA DE GRUPOS COM CHECKBOX -->
                        <div id="mediaBatchGroups" class="checkbox-group">
                            <div class="loading-text">Carregando grupos...</div>
                        </div>
                        
                        <small style="color: #666; display: block; margin-top: 5px;">
                            <span id="groupsCounter">Mostrando todos os grupos disponíveis</span>
                        </small>
                    </div>

                    <div class="form-group">
                        <label>Arquivo de Mídia:</label>
                        <div class="file-upload-area" id="mediaUploadArea">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Clique para selecionar ou arraste e solte o arquivo aqui</p>
                            <input type="file" id="mediaFilesInput" accept="image/*,video/*,audio/*,application/pdf" style="display: none;" multiple>
                        </div>
                        <div id="filePreview" class="file-preview"></div>
                        ${existingMediaInfo}
                    </div>

                    <div class="form-group">
                        <label for="mediaBatchCaption">Legenda (opcional):</label>
                        <textarea id="mediaBatchCaption" rows="3" placeholder="Digite a mensagem que acompanhará a mídia...">${existingCaption}</textarea>
                    </div>

                    <div class="form-group">
                        <label for="mediaDelay">Intervalo entre envios (ms):</label>
                        <input type="number" id="mediaDelay" value="3000" min="1000" max="60000">
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancelMediaBatchBtn">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${buttonText}</button>
                    </div>
                </form>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.currentModal = 'mediaBatchModal';

        // Se estiver editando, preservar dados do lote
        if (isEdit) {
            this.preservedBatchData = batchData;
        }

        // Configurar eventos de fechamento
        this.setupModalEvents();
        this.initMediaBatchForm(batchData);
    }

    // NOVO MÉTODO: Renderizar informações das mídias existentes
    renderExistingMediaInfo(batchData) {
        if (!batchData.mediaItems || batchData.mediaItems.length === 0) {
            return `
            <div class="existing-media-info">
                <p><strong>Mídias existentes no lote:</strong> Nenhuma mídia encontrada</p>
            </div>
        `;
        }

        const mediaItems = batchData.mediaItems.slice(0, 10);
        const hasMore = batchData.mediaItems.length > 10;

        return `
        <div class="existing-media-info">
            <p><strong>Mídias existentes no lote:</strong> ${batchData.mediaItems.length} arquivo(s)</p>
            <small>Novos arquivos serão adicionados aos existentes. Clique no ❌ para remover mídias.</small>
            
            <div class="existing-media-preview">
                <h4>Prévia das Mídias:</h4>
                <div class="media-preview-grid">
                    ${mediaItems.map((media, index) => this.renderRemovableMediaPreview(media, index)).join('')}
                    ${hasMore ? `<div class="media-more">+${batchData.mediaItems.length - 10} mais...</div>` : ''}
                </div>
            </div>
        </div>
    `;
    }

    // ✅ NOVO MÉTODO: Renderizar mídias com opção de remoção
    renderRemovableMediaPreview(media, index) {
        const fileType = media.fileType || media.mimeType || 'unknown';
        const fileName = media.originalName || media.fileName || `Mídia ${index + 1}`;
        const fileSize = media.fileSize ? this.formatFileSize(media.fileSize) : 'Tamanho desconhecido';

        let previewContent = '';
        let mediaClass = 'media-preview-item removable-media';

        if (fileType.startsWith('image/')) {
            mediaClass += ' media-type-image';
            const imageUrl = `/api/media/public-media/${this.getUserIdFromMedia(media)}/${this.getFilenameFromMedia(media)}`;

            previewContent = `
            <img src="${imageUrl}" alt="${fileName}" 
                 onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                 loading="lazy" />
            <div class="media-fallback" style="display: none;">
                <i class="fas fa-file-image"></i>
                <span>Erro ao carregar</span>
            </div>
        `;
        } else {
            // ... resto do código igual ao renderMediaPreview original
            mediaClass += ` media-type-${fileType.split('/')[0]}`;
            let iconClass = 'fas fa-file';

            if (fileType.startsWith('image/')) iconClass = 'fas fa-file-image';
            else if (fileType.startsWith('video/')) iconClass = 'fas fa-file-video';
            else if (fileType.startsWith('audio/')) iconClass = 'fas fa-file-audio';
            else if (fileType === 'application/pdf') iconClass = 'fas fa-file-pdf';

            previewContent = `
            <div class="media-fallback">
                <i class="${iconClass}"></i>
                <span>${fileType.split('/')[0]}</span>
            </div>
        `;
        }

        return `
    <div class="${mediaClass}" data-media-index="${index}" data-media-id="${media._id || index}">
        <button type="button" class="remove-existing-media" onclick="app.mediaBatchesManager.removeExistingMedia(${index})" title="Remover mídia">
            <i class="fas fa-times"></i>
        </button>
        <div class="media-preview-content">
            ${previewContent}
        </div>
        <div class="media-preview-info">
            <div class="media-name">${this.truncateFileName(fileName)}</div>
            <div class="media-size">${fileSize}</div>
        </div>
    </div>
    `;
    }

    // ✅ NOVO MÉTODO: Remover mídia existente
    removeExistingMedia(index) {
        if (!this.preservedBatchData || !this.preservedBatchData.mediaItems) {
            console.error('❌ Nenhum batch data preservado encontrado');
            return;
        }

        if (confirm('Tem certeza que deseja remover esta mídia do lote?')) {
            // Remover do array preservado
            this.preservedBatchData.mediaItems.splice(index, 1);

            // Recriar a seção de mídias existentes
            const existingMediaContainer = document.querySelector('.existing-media-info');
            if (existingMediaContainer) {
                existingMediaContainer.outerHTML = this.renderExistingMediaInfo(this.preservedBatchData);
            }

            this.safeShowNotification('✅ Mídia removida do lote', 'success');
        }
    }


    // ✅ MÉTODO CORRIGIDO: Carregar mídia como Base64
    async loadMediaAsBase64(media, index) {
        try {
            console.log('🖼️ Carregando mídia como base64:', {
                index,
                fileName: media.fileName,
                url: media.url
            });

            // Extrair userId e filename da URL
            const urlParts = media.url.split('/');
            const userId = urlParts[urlParts.length - 2];
            const filename = urlParts[urlParts.length - 1];

            console.log('🔍 Parâmetros extraídos:', { userId, filename });

            const response = await this.safeApiRequest(
                'GET',
                `/api/media/media-file/${userId}/${filename}`
            );

            if (response.success && response.data) {
                console.log('✅ Base64 carregado com sucesso para índice:', index);

                // Atualizar o preview com a imagem base64
                const mediaElement = document.querySelector(`[data-media-index="${index}"] .media-preview-content`);
                if (mediaElement) {
                    mediaElement.innerHTML = `<img src="${response.data}" alt="${media.originalName}" />`;
                    console.log('✅ Preview atualizado com imagem base64');
                }

                // Também atualizar o objeto media para cache
                if (this.preservedBatchData && this.preservedBatchData.mediaItems[index]) {
                    this.preservedBatchData.mediaItems[index].base64Data = response.data;
                }
            } else {
                console.error('❌ Resposta da API não sucedida:', response);
                this.showFallbackIcon(media, index);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar mídia como base64:', error);
            this.showFallbackIcon(media, index);
        }
    }

    // ✅ MÉTODO AUXILIAR: Mostrar ícone de fallback
    showFallbackIcon(media, index) {
        const mediaElement = document.querySelector(`[data-media-index="${index}"] .media-preview-content`);
        if (mediaElement) {
            const fileType = media.fileType || media.mimeType || 'unknown';
            let iconClass = 'fas fa-file';

            if (fileType.startsWith('image/')) iconClass = 'fas fa-file-image';
            else if (fileType.startsWith('video/')) iconClass = 'fas fa-file-video';
            else if (fileType.startsWith('audio/')) iconClass = 'fas fa-file-audio';
            else if (fileType === 'application/pdf') iconClass = 'fas fa-file-pdf';

            mediaElement.innerHTML = `
            <div class="media-fallback">
                <i class="${iconClass}"></i>
            </div>
        `;
        }
    }

    // ✅ MÉTODO MELHORADO: Renderizar prévia real das mídias
    // MediaBatchesManager.js - USAR ENDPOINT PÚBLICO

    renderMediaPreview(media, index) {
        const fileType = media.fileType || media.mimeType || 'unknown';
        const fileName = media.originalName || media.fileName || `Mídia ${index + 1}`;
        const fileSize = media.fileSize ? this.formatFileSize(media.fileSize) : 'Tamanho desconhecido';

        let previewContent = '';
        let mediaClass = 'media-preview-item';

        // ✅ USAR ENDPOINT PÚBLICO PARA IMAGENS
        if (fileType.startsWith('image/')) {
            mediaClass += ' media-type-image';

            // Construir URL pública para a imagem
            const imageUrl = `/api/media/public-media/${this.getUserIdFromMedia(media)}/${this.getFilenameFromMedia(media)}`;

            console.log('🖼️ Gerando URL da imagem:', imageUrl);

            previewContent = `
            <img src="${imageUrl}" alt="${fileName}" 
                 onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                 loading="lazy" />
            <div class="media-fallback" style="display: none;">
                <i class="fas fa-file-image"></i>
                <span>Erro ao carregar</span>
            </div>
        `;
        } else if (fileType.startsWith('video/')) {
            mediaClass += ' media-type-video';
            previewContent = `
            <div class="media-fallback">
                <i class="fas fa-file-video"></i>
                <span>Vídeo</span>
            </div>
        `;
        } else if (fileType.startsWith('audio/')) {
            mediaClass += ' media-type-audio';
            previewContent = `
            <div class="media-fallback">
                <i class="fas fa-file-audio"></i>
                <span>Áudio</span>
            </div>
        `;
        } else if (fileType === 'application/pdf') {
            mediaClass += ' media-type-pdf';
            previewContent = `
            <div class="media-fallback">
                <i class="fas fa-file-pdf"></i>
                <span>PDF</span>
            </div>
        `;
        } else {
            mediaClass += ' media-type-unknown';
            previewContent = `
            <div class="media-fallback">
                <i class="fas fa-file"></i>
                <span>Arquivo</span>
            </div>
        `;
        }

        return `
        <div class="${mediaClass}" data-media-index="${index}" title="${fileName} (${fileSize})">
            <div class="media-preview-content">
                ${previewContent}
            </div>
            <div class="media-preview-info">
                <div class="media-name">${this.truncateFileName(fileName)}</div>
                <div class="media-size">${fileSize}</div>
            </div>
        </div>
    `;
    }

    // ✅ MÉTODO AUXILIAR PARA TRUNCAR NOME DO ARQUIVO
    truncateFileName(fileName) {
        if (fileName.length > 20) {
            const ext = fileName.split('.').pop();
            const name = fileName.substring(0, 15);
            return `${name}...${ext}`;
        }
        return fileName;
    }

    getUserIdFromMedia(media) {
        if (media.url) {
            const urlParts = media.url.split('/');
            return urlParts[urlParts.length - 2];
        }
        return null;
    }

    getFilenameFromMedia(media) {
        if (media.url) {
            const urlParts = media.url.split('/');
            return urlParts[urlParts.length - 1];
        }
        return null;
    }

    getUserIdFromMedia(media) {
        if (media.url) {
            const urlParts = media.url.split('/');
            return urlParts[urlParts.length - 2];
        }
        return null;
    }

    getFilenameFromMedia(media) {
        if (media.url) {
            const urlParts = media.url.split('/');
            return urlParts[urlParts.length - 1];
        }
        return null;
    }

    // ✅ MÉTODOS AUXILIARES PARA EXTRAIR USER ID E FILENAME
    getUserIdFromMedia(media) {
        if (media.url) {
            const urlParts = media.url.split('/');
            return urlParts[urlParts.length - 2]; // userId
        }
        return null;
    }

    getFilenameFromMedia(media) {
        if (media.url) {
            const urlParts = media.url.split('/');
            return urlParts[urlParts.length - 1]; // filename
        }
        return null;
    }

    // ✅ ATUALIZAR O MÉTODO reuseBatch
    async reuseBatch(batchId) {
        try {
            console.log(`🔄 Reutilizando lote: ${batchId}`);
            const response = await this.safeApiRequest('GET', `/api/media/batches/${batchId}`);

            if (response.success) {
                console.log('✅ Batch carregado para reutilização:', {
                    name: response.batch.name,
                    mediaCount: response.batch.mediaItems?.length,
                    caption: response.batch.caption
                });

                // ✅ CARREGAR MÍDIAS COMO BASE64 APENAS SE FOREM IMAGENS
                if (response.batch.mediaItems && response.batch.mediaItems.length > 0) {
                    console.log('🖼️ Verificando mídias para carregar como base64...');

                    for (let i = 0; i < response.batch.mediaItems.length; i++) {
                        const media = response.batch.mediaItems[i];
                        if (media.mimeType && media.mimeType.startsWith('image/')) {
                            try {
                                const urlParts = media.url.split('/');
                                const userId = urlParts[urlParts.length - 2];
                                const filename = urlParts[urlParts.length - 1];

                                console.log(`📥 Carregando imagem ${i}: ${filename}`);

                                const mediaResponse = await this.safeApiRequest(
                                    'GET',
                                    `/api/media/media-file/${userId}/${filename}`
                                );

                                if (mediaResponse.success) {
                                    response.batch.mediaItems[i].base64Data = mediaResponse.data;
                                    console.log(`✅ Imagem ${i} carregada como base64`);
                                } else {
                                    console.warn(`⚠️ Falha ao carregar imagem ${i}:`, mediaResponse.error);
                                }
                            } catch (error) {
                                console.warn(`⚠️ Erro ao carregar imagem ${i}:`, error.message);
                            }
                        }
                    }
                }

                this.showMediaBatchModal(response.batch);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao carregar batch para reutilização:', error);
            this.safeShowNotification(`❌ Erro: ${error.message}`, 'error');
        }
    }


    setupModalEvents() {
        // Fechar com botão X
        document.getElementById('closeMediaBatchModal').addEventListener('click', () => {
            console.log('❌ Fechando modal via botão X...');
            this.safeCloseModal('mediaBatchModal');
        });

        // Fechar com botão Cancelar
        document.getElementById('cancelMediaBatchBtn').addEventListener('click', () => {
            console.log('❌ Cancelando modal via botão Cancelar...');
            this.safeCloseModal('mediaBatchModal');
        });

        // Fechar ao clicar fora do conteúdo
        document.getElementById('mediaBatchModal').addEventListener('click', (e) => {
            if (e.target.id === 'mediaBatchModal') {
                console.log('❌ Fechando modal ao clicar fora...');
                this.safeCloseModal('mediaBatchModal');
            }
        });

        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal === 'mediaBatchModal') {
                console.log('❌ Fechando modal com ESC...');
                this.safeCloseModal('mediaBatchModal');
            }
        });
    }

    async initMediaBatchForm(batchData = null) {
        console.log('📝 Inicializando formulário do modal...');
        await this.loadInstancesToSelect(batchData);
        await this.loadGroupsToSelect(batchData);
        this.initFileUpload();

        document.getElementById('mediaBatchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('📤 Submetendo formulário...');
            this.createMediaBatch(batchData);
        });

        // ✅ FOCUS NA BARRA DE PESQUISA
        setTimeout(() => {
            const searchInput = document.getElementById('groupSearch');
            if (searchInput) {
                searchInput.focus();
            }
        }, 500);
    }

    async loadInstancesToSelect(batchData = null) {
        try {
            const select = document.getElementById('mediaBatchInstance');
            if (!select) {
                console.error('❌ Select de instâncias não encontrado');
                return;
            }

            select.innerHTML = '<option value="">Carregando instâncias...</option>';
            const response = await this.safeApiRequest('GET', '/api/whatsapp/instances');

            console.log('📱 Resposta completa das instâncias:', response);

            if (response.success && Array.isArray(response.instances)) {
                select.innerHTML = '<option value="">Selecione uma instância...</option>';

                // Filtrar instâncias disponíveis (com phoneNumber)
                const availableInstances = response.instances.filter(instance =>
                    instance.phoneNumber
                );

                console.log('✅ Instâncias disponíveis para select:', availableInstances);

                if (availableInstances.length === 0) {
                    select.innerHTML = '<option value="">Nenhuma instância disponível</option>';
                    this.safeShowNotification('⚠️ Nenhuma instância com número de telefone encontrada', 'warning');
                    return;
                }

                availableInstances.forEach(instance => {
                    const option = document.createElement('option');
                    option.value = instance._id;

                    // Formatar número para exibição
                    const phoneDisplay = instance.phoneNumber ?
                        instance.phoneNumber.replace('@s.whatsapp.net', '').replace('55', '') :
                        'Número não disponível';

                    const statusText = instance.status === 'connected' ? 'Conectada' :
                        instance.status || 'Desconhecido';

                    option.textContent = `${instance.sessionName} (${phoneDisplay}) - ${statusText}`;

                    // Selecionar instância do batch se estiver reutilizando
                    if (batchData && batchData.whatsappInstance && batchData.whatsappInstance._id === instance._id) {
                        option.selected = true;
                    }

                    select.appendChild(option);
                });

                console.log(`✅ ${availableInstances.length} instâncias carregadas no select`);
            } else {
                console.error('❌ Estrutura inválida na resposta:', response);
                select.innerHTML = '<option value="">Erro ao carregar instâncias</option>';
            }
        } catch (error) {
            console.error('❌ Erro ao carregar instâncias:', error);
            const select = document.getElementById('mediaBatchInstance');
            if (select) {
                select.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        }
    }

    async loadGroupsToSelect(batchData = null) {
        try {
            const container = document.getElementById('mediaBatchGroups');
            if (!container) {
                console.error('❌ Container de grupos não encontrado');
                return;
            }

            container.innerHTML = '<div class="loading-text">Carregando grupos...</div>';
            const response = await this.safeApiRequest('GET', '/api/contact-groups?limit=100');

            console.log('👥 Resposta completa dos grupos:', response);

            if (response.success && Array.isArray(response.contactGroups)) {
                this.allGroups = response.contactGroups; // ✅ SALVAR GRUPOS PARA PESQUISA
                this.renderGroupsList(this.allGroups, batchData);
                this.initSearchFunctionality();
                this.initSelectedGroupsBadges();
            } else {
                console.error('❌ Estrutura inválida na resposta:', response);
                container.innerHTML = '<div class="error-text">Erro ao carregar grupos</div>';
            }
        } catch (error) {
            console.error('❌ Erro ao carregar grupos:', error);
            const container = document.getElementById('mediaBatchGroups');
            if (container) {
                container.innerHTML = '<div class="error-text">Erro ao carregar grupos</div>';
            }
        }
    }

    // ✅ NOVO MÉTODO: Renderizar lista de grupos com suporte a pesquisa
    renderGroupsList(groups, batchData = null) {
        const container = document.getElementById('mediaBatchGroups');
        if (!container) return;

        container.innerHTML = '';

        if (groups.length === 0) {
            container.innerHTML = '<div class="no-groups">Nenhum grupo encontrado</div>';
            return;
        }

        // Mostrar todos os grupos
        groups.forEach(group => {
            const checkbox = document.createElement('div');
            checkbox.className = 'checkbox-item';
            checkbox.dataset.groupId = group._id;
            checkbox.dataset.groupName = group.name;

            const contactCount = group.contacts ? group.contacts.length : 0;
            const isEmpty = contactCount === 0;

            // Verificar se este grupo estava no batch original
            const isChecked = batchData && batchData.contactGroups ?
                batchData.contactGroups.some(g => g._id === group._id) : false;

            checkbox.innerHTML = `
            <label>
                <input type="checkbox" name="contactGroups" value="${group._id}" 
                    ${isEmpty ? 'disabled' : ''} ${isChecked ? 'checked' : ''}>
                <span class="${isEmpty ? 'empty-group' : ''}">
                    ${group.name} (${contactCount} contatos)
                    ${isEmpty ? ' - <em>vazio</em>' : ''}
                </span>
            </label>
        `;
            container.appendChild(checkbox);
        });

        // Adicionar contador
        const totalGroups = groups.length;
        const groupsWithContacts = groups.filter(g => g.contacts && g.contacts.length > 0).length;

        const counter = document.createElement('div');
        counter.className = 'groups-counter';
        counter.innerHTML = `<strong>${groupsWithContacts}/${totalGroups}</strong> grupos com contatos`;
        container.appendChild(counter);

        // ✅ ATUALIZAR BADGES SE HOUVER GRUPOS SELECIONADOS
        if (batchData && batchData.contactGroups) {
            this.updateSelectedGroupsBadges(batchData.contactGroups);
        }
    }

    // ✅ NOVO MÉTODO: Inicializar funcionalidade de pesquisa
    initSearchFunctionality() {
        const searchInput = document.getElementById('groupSearch');
        const searchClear = document.getElementById('searchClear');
        const searchResultsCount = document.getElementById('searchResultsCount');
        const groupsCounter = document.getElementById('groupsCounter');

        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();

            // Mostrar/ocultar botão de limpar
            searchClear.style.display = searchTerm ? 'flex' : 'none';

            if (searchTerm) {
                this.filterGroups(searchTerm);
                searchResultsCount.textContent = `Encontrados ${this.getVisibleGroupsCount()} grupos`;
                groupsCounter.textContent = `Mostrando resultados da pesquisa`;
            } else {
                this.clearSearch();
                searchResultsCount.textContent = '';
                groupsCounter.textContent = 'Mostrando todos os grupos disponíveis';
            }
        });

        // Limpar pesquisa
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            searchResultsCount.textContent = '';
            groupsCounter.textContent = 'Mostrando todos os grupos disponíveis';
            this.clearSearch();
            searchInput.focus();
        });

        // Tecla ESC para limpar pesquisa
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchClear.style.display = 'none';
                searchResultsCount.textContent = '';
                groupsCounter.textContent = 'Mostrando todos os grupos disponíveis';
                this.clearSearch();
            }
        });
    }

    // ✅ NOVO MÉTODO: Filtrar grupos
    filterGroups(searchTerm) {
        const checkboxes = document.querySelectorAll('.checkbox-item');
        let visibleCount = 0;

        checkboxes.forEach(checkbox => {
            const groupName = checkbox.dataset.groupName.toLowerCase();
            if (groupName.includes(searchTerm)) {
                checkbox.classList.remove('hidden');
                visibleCount++;
            } else {
                checkbox.classList.add('hidden');
            }
        });

        // Atualizar contador
        const counter = document.querySelector('.groups-counter');
        if (counter) {
            const totalWithContacts = this.allGroups.filter(g => g.contacts && g.contacts.length > 0).length;
            counter.innerHTML = `<strong>${visibleCount}/${this.allGroups.length}</strong> grupos encontrados`;
        }
    }

    // ✅ NOVO MÉTODO: Limpar pesquisa
    clearSearch() {
        const checkboxes = document.querySelectorAll('.checkbox-item');
        checkboxes.forEach(checkbox => {
            checkbox.classList.remove('hidden');
        });

        // Restaurar contador original
        const counter = document.querySelector('.groups-counter');
        if (counter && this.allGroups) {
            const groupsWithContacts = this.allGroups.filter(g => g.contacts && g.contacts.length > 0).length;
            counter.innerHTML = `<strong>${groupsWithContacts}/${this.allGroups.length}</strong> grupos com contatos`;
        }
    }

    // ✅ NOVO MÉTODO: Obter contagem de grupos visíveis
    getVisibleGroupsCount() {
        const visibleCheckboxes = document.querySelectorAll('.checkbox-item:not(.hidden)');
        return visibleCheckboxes.length;
    }

    // ✅ NOVO MÉTODO: Inicializar badges dos grupos selecionados
    initSelectedGroupsBadges() {
        const container = document.getElementById('selectedGroupsBadges');
        if (!container) return;

        // Atualizar badges quando checkboxes mudarem
        document.addEventListener('change', (e) => {
            if (e.target.name === 'contactGroups') {
                this.updateSelectedGroupsBadges();
            }
        });
    }

    // ✅ NOVO MÉTODO: Atualizar badges dos grupos selecionados
    updateSelectedGroupsBadges(specificGroups = null) {
        const container = document.getElementById('selectedGroupsBadges');
        if (!container) return;

        let selectedGroups = [];

        if (specificGroups) {
            // Usar grupos específicos (para reutilização)
            selectedGroups = specificGroups;
        } else {
            // Obter grupos selecionados dos checkboxes
            const selectedCheckboxes = document.querySelectorAll('input[name="contactGroups"]:checked:not(:disabled)');
            selectedGroups = Array.from(selectedCheckboxes).map(checkbox => {
                const checkboxItem = checkbox.closest('.checkbox-item');
                return {
                    _id: checkbox.value,
                    name: checkboxItem?.dataset.groupName || 'Grupo'
                };
            });
        }

        if (selectedGroups.length === 0) {
            container.innerHTML = '<div class="no-groups-selected">Nenhum grupo selecionado</div>';
            return;
        }

        container.innerHTML = selectedGroups.map(group => `
        <div class="group-badge" data-group-id="${group._id}">
            <span class="group-name">${group.name}</span>
            <button type="button" class="remove-badge" data-group-id="${group._id}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

        // Adicionar evento de remoção aos badges
        container.querySelectorAll('.remove-badge').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const groupId = button.dataset.groupId;
                this.removeGroupSelection(groupId);
            });
        });
    }

    // ✅ NOVO MÉTODO: Remover seleção de grupo
    removeGroupSelection(groupId) {
        // Desmarcar checkbox
        const checkbox = document.querySelector(`input[name="contactGroups"][value="${groupId}"]`);
        if (checkbox) {
            checkbox.checked = false;
        }

        // Atualizar badges
        this.updateSelectedGroupsBadges();
    }

    async createMediaBatch(existingBatchData = null) {
        try {
            this.safeShowLoading(true);

            // Validações
            if (this.uploadedFiles.length === 0 && !existingBatchData) {
                this.safeShowNotification('❌ Selecione pelo menos um arquivo de mídia', 'error');
                this.safeShowLoading(false);
                return;
            }

            const selectedGroups = Array.from(document.querySelectorAll('input[name="contactGroups"]:checked'));
            if (selectedGroups.length === 0) {
                this.safeShowNotification('❌ Selecione pelo menos um grupo de contatos', 'error');
                this.safeShowLoading(false);
                return;
            }

            const instanceSelect = document.getElementById('mediaBatchInstance');
            if (!instanceSelect.value) {
                this.safeShowNotification('❌ Selecione uma instância WhatsApp', 'error');
                this.safeShowLoading(false);
                return;
            }

            const batchName = document.getElementById('mediaBatchName').value.trim();
            if (!batchName) {
                this.safeShowNotification('❌ Digite um nome para o lote', 'error');
                this.safeShowLoading(false);
                return;
            }

            // CORREÇÃO: Capturar a legenda do textarea
            const caption = document.getElementById('mediaBatchCaption').value.trim();
            console.log('📝 Legenda capturada:', caption);

            // ✅ CAPTURAR INSTÂNCIA ID PARA VALIDAÇÃO
            const whatsappInstanceId = instanceSelect.value;
            console.log(`🔍 Instância selecionada: ${whatsappInstanceId}`);

            let mediaItems = [];

            // Se estiver reutilizando um batch, usar as mídias existentes
            if (existingBatchData && existingBatchData.mediaItems) {
                mediaItems = [...existingBatchData.mediaItems];
                console.log(`✅ Reutilizando ${mediaItems.length} mídias existentes do lote original`);
            }

            // ✅ FAZER UPLOAD DE NOVOS ARQUIVOS COM VALIDAÇÃO DE INSTÂNCIA
            if (this.uploadedFiles.length > 0) {
                console.log('📤 Iniciando upload de novos arquivos com validação de instância...');

                for (const file of this.uploadedFiles) {
                    const formData = new FormData();
                    formData.append('mediaFiles', file);
                    formData.append('whatsappInstanceId', whatsappInstanceId); // ✅ ENVIAR INSTÂNCIA PARA VALIDAÇÃO

                    console.log(`📎 Enviando arquivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

                    const uploadResponse = await this.safeApiRequest('POST', '/api/media/upload', formData, true);

                    if (uploadResponse.success && uploadResponse.mediaItems) {
                        mediaItems.push(...uploadResponse.mediaItems);
                        console.log(`✅ Upload de ${file.name} concluído. Total de mídias: ${mediaItems.length}`);

                        // ✅ MOSTRAR PROGRESSO DO UPLOAD
                        this.safeShowNotification(`✅ ${file.name} salvo com sucesso`, 'success', 2000);
                    } else {
                        // fechar o  modal
                        this.safeCloseModal('mediaBatchModal');
                        console.error(`❌ Falha no upload de ${file.name}:`, uploadResponse);

                        // ✅ TRATAMENTO ESPECÍFICO PARA ERROS DE INSTÂNCIA
                        if (uploadResponse.error && uploadResponse.error.includes('Instância')) {
                            this.safeShowNotification(`❌ ${uploadResponse.error}`, 'error');
                        } else {
                            this.safeShowNotification(`❌ Falha no upload do arquivo: ${file.name}`, 'error');
                        }

                        // ❌ PARAR SE HOUVER ERRO DE INSTÂNCIA
                        if (uploadResponse.error && uploadResponse.error.includes('Instância')) {
                            this.safeShowLoading(false);
                            return;
                        }
                    }
                }

                // ✅ VERIFICAR SE ALGUM ARQUIVO FOI SALVO COM SUCESSO
                if (mediaItems.length === 0 && !existingBatchData) {
                    this.safeShowNotification('❌ Nenhum arquivo foi salvo com sucesso', 'error');
                    this.safeShowLoading(false);
                    return;
                }
            }

            if (mediaItems.length === 0) {
                this.safeShowNotification('❌ Nenhuma mídia disponível para envio', 'error');
                this.safeShowLoading(false);
                return;
            }

            console.log('📦 Criando lote de mídia...');
            const batchData = {
                name: batchName,
                mediaItems: mediaItems,
                contactGroupIds: selectedGroups.map(cb => cb.value),
                whatsappInstanceId: whatsappInstanceId,
                caption: caption, // CORREÇÃO: Usar a legenda capturada
                options: {
                    delayBetweenMessages: parseInt(document.getElementById('mediaDelay').value) || 3000,
                    sendAsDocument: false
                }
            };

            // Se for reutilização, marcar como novo batch
            if (existingBatchData) {
                batchData.originalBatchId = existingBatchData._id;
            }

            console.log('📋 Dados do lote:', {
                name: batchData.name,
                mediaItems: `Array com ${batchData.mediaItems.length} itens`,
                contactGroupIds: batchData.contactGroupIds.length,
                caption: batchData.caption ? `"${batchData.caption}"` : 'Nenhuma',
                originalBatchId: batchData.originalBatchId || 'Nenhum',
                instanceId: batchData.whatsappInstanceId
            });

            // ✅ VERIFICAR LIMITE DIÁRIO ANTES DE CRIAR O LOTE
            console.log('🔍 Verificando limites diários...');
            try {
                const limitResponse = await this.safeApiRequest('GET', `/api/media/rate-limit/${whatsappInstanceId}`);
                if (limitResponse.success && limitResponse.data) {
                    const { daily } = limitResponse.data;
                    console.log(`📊 Status de limites: ${daily.current}/${daily.max} mensagens hoje`);

                    if (daily.remaining <= 0) {
                        this.safeShowNotification(`❌ Limite diário de ${daily.max} mensagens excedido. Retome amanhã.`, 'error');
                        this.safeShowLoading(false);
                        return;
                    }

                    // ✅ AVISAR SE ESTÁ PRÓXIMO DO LIMITE
                    const totalSends = batchData.contactGroupIds.length * batchData.mediaItems.length;
                    if (daily.remaining < totalSends) {
                        this.safeShowNotification(`⚠️ Atenção: Você tem ${daily.remaining} mensagens restantes hoje (precisa de ${totalSends})`, 'warning');
                    }
                }
            } catch (limitError) {
                console.warn('⚠️ Não foi possível verificar limites:', limitError);
                // Continua mesmo sem verificação de limites
            }

            // ✅ CRIAR O LOTE
            const response = await this.safeApiRequest('POST', '/api/media/batches', batchData);

            if (response.success) {
                const message = existingBatchData ?
                    `✅ Lote reutilizado com sucesso! ${mediaItems.length} mídias incluídas.` :
                    `✅ Lote de mídia criado com sucesso! ${mediaItems.length} mídias incluídas.`;

                // ✅ INCLUIR INFORMAÇÕES DE LIMITE NA MENSAGEM DE SUCESSO
                let successMessage = message;
                if (response.rateLimitInfo) {
                    successMessage += ` Limite diário: ${response.rateLimitInfo.dailyRemaining}/${response.rateLimitInfo.dailyLimit} restantes.`;
                }

                this.safeShowNotification(successMessage, 'success');
                this.safeCloseModal('mediaBatchModal');
                this.loadMediaBatches();
                this.uploadedFiles = [];
                this.preservedBatchData = null;

                // ✅ MOSTRAR DETALHES DO LOTE CRIADO
                console.log('🎉 Lote criado com sucesso:', {
                    batchId: response.batch._id,
                    instance: response.batch.instance?.sessionName || 'N/A',
                    totalSends: response.batch.totalSends,
                    status: response.batch.status
                });

            } else {
                console.log('❌ Falha ao criar lote:', response);

                // ✅ TRATAMENTO ESPECÍFICO PARA ERROS DE INSTÂNCIA
                if (response.error && response.error.includes('Instância')) {
                    throw new Error(`Problema na instância WhatsApp: ${response.error}`);
                } else if (response.error && response.error.includes('Limite diário')) {
                    throw new Error(response.error);
                } else {
                    throw new Error(response.error || 'Erro desconhecido ao criar lote');
                }
            }
        } catch (error) {
            console.error('Erro ao criar lote de mídia:', error);

            // ✅ MENSAGENS DE ERRO MAIS ESPECÍFICAS
            let errorMessage = error.message;
            if (error.message.includes('Instância')) {
                errorMessage = `❌ ${error.message}`;
            } else if (error.message.includes('Limite diário')) {
                errorMessage = `🚫 ${error.message}`;
            } else {
                errorMessage = `❌ Erro: ${error.message}`;
            }

            this.safeShowNotification(errorMessage, 'error');
        } finally {
            this.safeShowLoading(false);
        }
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



    async cancelBatch(batchId) {
        try {
            if (!confirm('Tem certeza que deseja cancelar este lote?')) return;

            const response = await this.safeApiRequest('PUT', `/api/media/batches/${batchId}/cancel`);

            if (response.success) {
                this.safeShowNotification('✅ Lote cancelado com sucesso', 'success');
                this.loadMediaBatches(this.currentPage);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao cancelar lote:', error);
            this.safeShowNotification(`❌ Erro: ${error.message}`, 'error');
        }
    }

    async deleteBatch(batchId) {
        try {
            if (!confirm('Tem certeza que deseja excluir este lote? Esta ação não pode ser desfeita.')) return;

            this.safeShowLoading(true);
            const response = await this.safeApiRequest('DELETE', `/api/media/batches/${batchId}`);

            if (response.success) {
                this.safeShowNotification('✅ Lote excluído com sucesso', 'success');
                // ✅ CORREÇÃO: Recarregar a lista atual
                this.loadMediaBatches(this.currentPage);
            } else {
                throw new Error(response.error || 'Erro desconhecido ao excluir lote');
            }
        } catch (error) {
            console.error('Erro ao excluir lote:', error);
            this.safeShowNotification(`❌ Erro: ${error.message}`, 'error');
        } finally {
            this.safeShowLoading(false);
        }
    }

    // ✅ ATUALIZAR O MÉTODO reuseBatch para carregar mídias como base64
    async reuseBatch(batchId) {
        try {
            console.log(`🔄 Reutilizando lote: ${batchId}`);
            const response = await this.safeApiRequest('GET', `/api/media/batches/${batchId}`);

            if (response.success) {
                console.log('✅ Batch carregado para reutilização:', response.batch);

                // ✅ CARREGAR MÍDIAS COMO BASE64
                if (response.batch.mediaItems && response.batch.mediaItems.length > 0) {
                    console.log('🖼️ Carregando mídias como base64...');

                    // Podemos carregar as primeiras 3-5 imagens em base64 para preview
                    const previewMediaItems = response.batch.mediaItems.slice(0, 5);

                    for (let i = 0; i < previewMediaItems.length; i++) {
                        const media = previewMediaItems[i];
                        if (media.mimeType && media.mimeType.startsWith('image/')) {
                            try {
                                const urlParts = media.url.split('/');
                                const userId = urlParts[urlParts.length - 2];
                                const filename = urlParts[urlParts.length - 1];

                                const mediaResponse = await this.safeApiRequest(
                                    'GET',
                                    `/api/media/media/${userId}/${filename}`
                                );

                                if (mediaResponse.success) {
                                    response.batch.mediaItems[i].base64Data = mediaResponse.data;
                                }
                            } catch (error) {
                                console.warn(`⚠️ Não foi possível carregar imagem ${i} como base64:`, error);
                            }
                        }
                    }
                }

                this.showMediaBatchModal(response.batch);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao carregar batch para reutilização:', error);
            this.safeShowNotification(`❌ Erro: ${error.message}`, 'error');
        }
    }

    async viewBatchDetails(batchId) {
        try {
            console.log(`🔍 Buscando detalhes do batch: ${batchId}`);

            const response = await this.safeApiRequest('GET', `/api/media/batches/${batchId}`);

            if (response.success && response.batch) {
                console.log('✅ Detalhes do batch carregados:', response.batch);
                this.showBatchDetailsModal(response.batch);
            } else {
                throw new Error(response.error || 'Não foi possível carregar os detalhes do lote');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar detalhes do batch:', error);
            this.safeShowNotification(`❌ Erro: ${error.message}`, 'error');
        }
    }

    showBatchDetailsModal(batch) {
        console.log('📋 Mostrando modal de detalhes:', batch);

        // ✅ CORREÇÃO: Usar estrutura correta dos dados do batch
        const mediaCount = batch.mediaItems ? batch.mediaItems.length : 0;
        const groupCount = batch.contactGroups ? batch.contactGroups.length : 0;

        // ✅ CORREÇÃO CRÍTICA: Usar progress.sent e progress.total em vez de sent e totalSends
        const sentCount = batch.progress?.sent || 0;
        const totalSends = batch.progress?.total || 0;
        const failedCount = batch.progress?.failed || 0;

        const progress = this.calculateProgress(batch);
        const successRate = totalSends > 0 ? Math.round(((sentCount - failedCount) / totalSends) * 100) : 0;

        const modalHTML = `
    <div id="batchDetailsModal" class="modal" style="display: block;">
        <div class="modal-content" style="max-width: 900px;">
            <span class="close" id="closeBatchDetailsModal">&times;</span>
            <h3><i class="fas fa-info-circle"></i> Detalhes do Lote: ${this.escapeHtml(batch.name)}</h3>
            
            <div class="batch-details">
                <!-- Seção: Informações Gerais -->
                <div class="detail-section">
                    <h4><i class="fas fa-chart-bar"></i> Informações Gerais</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong><i class="fas fa-tag"></i> Status:</strong>
                            <span class="status ${batch.status}">${this.getStatusText(batch.status)}</span>
                        </div>
                        <div class="detail-item">
                            <strong><i class="fas fa-progress"></i> Progresso:</strong>
                            <div class="progress-display">
                                <span>${sentCount} / ${totalSends} enviados</span>
                                <div class="mini-progress-bar">
                                    <div class="mini-progress-fill" style="width: ${progress}%"></div>
                                </div>
                                <span class="progress-percent">${progress}%</span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <strong><i class="fas fa-chart-pie"></i> Estatísticas:</strong>
                            <span>${sentCount - failedCount} ✓ | ${failedCount} ✗ | ${successRate}% sucesso</span>
                        </div>
                        <div class="detail-item">
                            <strong><i class="fas fa-images"></i> Mídias:</strong>
                            <span>${mediaCount} arquivo(s)</span>
                        </div>
                        <div class="detail-item">
                            <strong><i class="fas fa-users"></i> Grupos:</strong>
                            <span>${groupCount} grupo(s)</span>
                        </div>
                        <div class="detail-item">
                            <strong><i class="fas fa-comment"></i> Legenda:</strong>
                            <span>${batch.caption ? 'Sim' : 'Nenhuma'}</span>
                        </div>
                        <div class="detail-item">
                            <strong><i class="fas fa-calendar"></i> Criado em:</strong>
                            <span>${new Date(batch.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        ${batch.whatsappInstance ? `
                        <div class="detail-item">
                            <strong><i class="fab fa-whatsapp"></i> Instância:</strong>
                            <span>${batch.whatsappInstance.sessionName} (${batch.whatsappInstance.phoneNumber || 'N/A'})</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Seção: Legenda (se existir) -->
                ${batch.caption ? `
                <div class="detail-section">
                    <h4><i class="fas fa-comment-dots"></i> Legenda Completa</h4>
                    <div class="caption-display">
                        <p>${this.escapeHtml(batch.caption)}</p>
                    </div>
                </div>
                ` : ''}
                
                <!-- Seção: Mídias -->
                ${batch.mediaItems && batch.mediaItems.length > 0 ? `
                <div class="detail-section">
                    <h4><i class="fas fa-photo-video"></i> Mídias (${batch.mediaItems.length})</h4>
                    <div class="media-preview-grid large">
                        ${batch.mediaItems.map((media, index) => this.renderMediaPreview(media, index)).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- Seção: Grupos -->
                ${batch.contactGroups && batch.contactGroups.length > 0 ? `
                <div class="detail-section">
                    <h4><i class="fas fa-users"></i> Grupos de Contatos (${batch.contactGroups.length})</h4>
                    <div class="groups-list">
                        ${batch.contactGroups.map(group => `
                            <div class="group-item">
                                <i class="fas fa-users"></i>
                                <span class="group-name">${this.escapeHtml(group.name)}</span>
                                <span class="group-count">${group.contactCount || 0} contatos</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- Seção: Resultados -->
                <div class="detail-section">
                    <h4><i class="fas fa-list-check"></i> Resultados do Envio</h4>
                    <div class="results-header">
                        <div class="results-stats">
                            <span class="stat success">${sentCount - failedCount} enviados</span>
                            <span class="stat failed">${failedCount} falhas</span>
                            <span class="stat total">${totalSends} total</span>
                        </div>
                        ${batch.results && batch.results.length > 10 ? `
                        <div class="results-filter">
                            <input type="text" id="resultsSearch" placeholder="Filtrar resultados..." class="search-input">
                        </div>
                        ` : ''}
                    </div>
                    <div class="results-list" id="resultsList">
                        ${this.renderResults(batch.results || [])}
                    </div>
                </div>
                
                <!-- Seção: Opções de Envio -->
                ${batch.options ? `
                <div class="detail-section">
                    <h4><i class="fas fa-cog"></i> Configurações de Envio</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong>Delay entre mensagens:</strong>
                            <span>${batch.options.delayBetweenMessages || 3000}ms</span>
                        </div>
                        <div class="detail-item">
                            <strong>Enviar como documento:</strong>
                            <span>${batch.options.sendAsDocument ? 'Sim' : 'Não'}</span>
                        </div>
                        ${batch.options.caption ? `
                        <div class="detail-item">
                            <strong>Legenda nas opções:</strong>
                            <span>${this.escapeHtml(batch.options.caption)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
            
            <!-- Botões de Ação -->
            <div class="modal-actions">
                <button class="btn btn-secondary" id="closeDetailsBtn">
                    <i class="fas fa-times"></i> Fechar
                </button>
                ${(batch.status === 'completed' || batch.status === 'completed_with_errors') ? `
                <button class="btn btn-success" id="reuseFromDetailsBtn">
                    <i class="fas fa-recycle"></i> Reutilizar Este Lote
                </button>
                ` : ''}
                <button class="btn btn-info" onclick="window.print()">
                    <i class="fas fa-print"></i> Imprimir Relatório
                </button>
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

        // Configurar eventos
        this.setupBatchDetailsEvents(batch);
    }

    // ✅ NOVO: Configurar eventos do modal de detalhes
    setupBatchDetailsEvents(batch) {
        // Fechar modal
        document.getElementById('closeBatchDetailsModal').addEventListener('click', () => {
            this.safeCloseModal('batchDetailsModal');
        });

        document.getElementById('closeDetailsBtn').addEventListener('click', () => {
            this.safeCloseModal('batchDetailsModal');
        });

        // Reutilizar lote
        const reuseBtn = document.getElementById('reuseFromDetailsBtn');
        if (reuseBtn) {
            reuseBtn.addEventListener('click', () => {
                this.safeCloseModal('batchDetailsModal');
                this.reuseBatch(batch._id);
            });
        }

        // Fechar ao clicar fora
        document.getElementById('batchDetailsModal').addEventListener('click', (e) => {
            if (e.target.id === 'batchDetailsModal') {
                this.safeCloseModal('batchDetailsModal');
            }
        });

        // Filtro de resultados
        const searchInput = document.getElementById('resultsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterResults(e.target.value, batch.results || []);
            });
        }

        // Tecla ESC para fechar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.safeCloseModal('batchDetailsModal');
            }
        });
    }

    renderResults(results) {
        if (!results || results.length === 0) {
            return `
            <div class="no-results">
                <i class="fas fa-inbox"></i>
                <p>Nenhum resultado disponível</p>
            </div>
        `;
        }

        return `
        <div class="results-table">
            <div class="table-header">
                <div class="col-contact">Contato</div>
                <div class="col-phone">Telefone</div>
                <div class="col-media">Mídia</div>
                <div class="col-status">Status</div>
                <div class="col-time">Horário</div>
            </div>
            <div class="table-body">
                ${results.map((result, index) => `
                    <div class="table-row ${result.status === 'failed' ? 'failed' : 'success'}">
                        <div class="col-contact" title="${this.escapeHtml(result.contact || 'N/A')}">
                            ${this.escapeHtml(result.contact || 'N/A')}
                        </div>
                        <div class="col-phone">${result.phone || 'N/A'}</div>
                        <div class="col-media" title="${this.escapeHtml(result.mediaItem || 'N/A')}">
                            ${this.escapeHtml(result.mediaItem || 'N/A')}
                        </div>
                        <div class="col-status">
                            <span class="status-badge ${result.status}">
                                ${result.status === 'sent' ? '✓ Enviado' : '✗ Falhou'}
                            </span>
                            ${result.error ? `<div class="error-tooltip">${this.escapeHtml(result.error)}</div>` : ''}
                        </div>
                        <div class="col-time">
                            ${result.timestamp ? new Date(result.timestamp).toLocaleTimeString('pt-BR') : 'N/A'}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    }

    // ✅ NOVO: Filtrar resultados
    filterResults(searchTerm, results) {
        const resultsList = document.getElementById('resultsList');
        if (!resultsList || !searchTerm) {
            resultsList.innerHTML = this.renderResults(results);
            return;
        }

        const filteredResults = results.filter(result =>
            (result.contact && result.contact.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (result.phone && result.phone.includes(searchTerm)) ||
            (result.mediaItem && result.mediaItem.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (result.error && result.error.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        resultsList.innerHTML = this.renderResults(filteredResults);
    }

    async getConnectedInstances() {
        try {
            console.log('🔍 Buscando instâncias conectadas...');
            const response = await this.safeApiRequest('GET', '/api/whatsapp/instances');

            console.log('📱 Resposta completa da API de instâncias:', response);

            if (response.success && Array.isArray(response.instances)) {
                const availableInstances = response.instances.filter(instance =>
                    instance.phoneNumber
                );
                console.log(`✅ Encontradas ${availableInstances.length} instâncias disponíveis`);
                return availableInstances;
            } else {
                console.warn('⚠️ Nenhuma instância encontrada ou resposta inválida');
                return [];
            }
        } catch (error) {
            console.error("❌ Erro ao buscar instâncias via API:", error);
            return [];
        }
    }

    async getContactGroups() {
        try {
            console.log('📡 Buscando TODOS os grupos de contatos (paginação automática)...');

            let allGroups = [];
            let currentPage = 1;
            let totalPages = 1;

            while (currentPage <= totalPages) {
                const response = await this.safeApiRequest(
                    'GET',
                    `/api/contact-groups?page=${currentPage}&limit=100`
                );

                if (response.success) {
                    const groups = response.contactGroups || [];
                    allGroups = allGroups.concat(groups);

                    totalPages = response.pages ?? 1;
                    console.log(`📃 Página ${currentPage}/${totalPages} carregada (${groups.length} grupos)`);

                    currentPage++;
                } else {
                    console.warn(`⚠️ Erro ao carregar página ${currentPage}, abortando...`);
                    break;
                }
            }

            console.log(`✅ Total de grupos carregados: ${allGroups.length}`);
            return allGroups;
        } catch (error) {
            console.error('❌ Erro ao carregar todos os grupos:', error);
            return [];
        }
    }

    // Métodos para upload de arquivos
    initFileUpload() {
        const uploadArea = document.getElementById('mediaUploadArea');
        const fileInput = document.getElementById('mediaFilesInput');

        if (!uploadArea || !fileInput) {
            console.error('❌ Elementos de upload não encontrados');
            return;
        }

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '#f0f8ff';
            uploadArea.style.borderColor = '#007bff';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.backgroundColor = '';
            uploadArea.style.borderColor = '';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '';
            uploadArea.style.borderColor = '';

            if (e.dataTransfer.files.length > 0) {
                this.handleFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFiles(e.target.files);
            }
        });
    }

    // ATUALIZAR O MÉTODO handleFiles
    handleFiles(files) {
        const preview = document.getElementById('filePreview');
        if (!preview) return;

        // Mostrar loading se for muitas imagens
        if (files.length > 3) {
            preview.innerHTML = '<div class="loading-text">Processando arquivos...</div>';
        }

        Array.from(files).forEach(file => {
            if (this.isValidFileType(file)) {
                this.uploadedFiles.push(file);
                this.createFilePreview(file, preview);
            } else {
                this.safeShowNotification(`❌ Tipo de arquivo não suportado: ${file.name}`, 'error');
            }
        });
    }

    isValidFileType(file) {
        const validTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
            'application/pdf'
        ];
        return validTypes.includes(file.type);
    }

    // NO MediaBatchesManager.js - ATUALIZAR O MÉTODO createFilePreview

    createFilePreview(file, container) {
        const preview = document.createElement('div');
        preview.className = 'file-preview-item';

        const fileIcon = this.getFileIcon(file.type);
        const fileSize = this.formatFileSize(file.size);

        // ✅ CORREÇÃO: SE FOR IMAGEM, CRIAR PREVIEW COM IMAGEM REAL
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();

            reader.onload = (e) => {
                preview.innerHTML = `
                <div class="file-info">
                    <div class="file-preview-image">
                        <img src="${e.target.result}" alt="${file.name}" />
                    </div>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                    <button type="button" class="remove-file" onclick="this.closest('.file-preview-item').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            };

            reader.readAsDataURL(file);
        } else {
            // Para outros tipos de arquivo, manter o ícone
            preview.innerHTML = `
            <div class="file-info">
                <i class="${fileIcon}"></i>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${fileSize}</div>
                </div>
                <button type="button" class="remove-file" onclick="this.closest('.file-preview-item').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        }

        container.appendChild(preview);
    }

    getFileIcon(fileType) {
        if (fileType.startsWith('image/')) return 'fas fa-file-image';
        if (fileType.startsWith('video/')) return 'fas fa-file-video';
        if (fileType.startsWith('audio/')) return 'fas fa-file-audio';
        if (fileType === 'application/pdf') return 'fas fa-file-pdf';
        return 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Inicialização global para garantir que os métodos estejam disponíveis
window.MediaBatchesManager = MediaBatchesManager;