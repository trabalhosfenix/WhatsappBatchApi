class MediaBatchesManager {
    constructor(app) {
        this.app = app;
        this.uploadedFiles = [];
        this.currentModal = null;
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

    async showMediaBatchModal() {
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
        this.createMediaBatchModal();
    }

    createMediaBatchModal() {
        console.log('🎨 Criando modal de envio de mídia...');
        
        const modalHTML = `
            <div id="mediaBatchModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 800px;">
                    <span class="close" id="closeMediaBatchModal">&times;</span>
                    <h3>Novo Envio de Mídia em Lote</h3>
                    
                    <form id="mediaBatchForm">
                        <div class="form-group">
                            <label for="mediaBatchName">Nome do Lote:</label>
                            <input type="text" id="mediaBatchName" placeholder="Ex: Campanha de Natal" required>
                        </div>

                        <div class="form-group">
                            <label for="mediaBatchInstance">Instância WhatsApp:</label>
                            <select id="mediaBatchInstance" required>
                                <option value="">Carregando instâncias...</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Grupos de Contatos:</label>
                            <div id="mediaBatchGroups" class="checkbox-group">
                                <div class="loading-text">Carregando grupos...</div>
                            </div>
                            <small style="color: #666; display: block; margin-top: 5px;">Mostrando todos os grupos disponíveis</small>
                        </div>

                        <div class="form-group">
                            <label>Arquivo de Mídia:</label>
                            <div class="file-upload-area" id="mediaUploadArea">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Clique para selecionar ou arraste e solte o arquivo aqui</p>
                                <input type="file" id="mediaFilesInput" accept="image/*,video/*,audio/*,application/pdf" style="display: none;" multiple>
                            </div>
                            <div id="filePreview" class="file-preview"></div>
                        </div>

                        <div class="form-group">
                            <label for="mediaBatchCaption">Legenda (opcional):</label>
                            <textarea id="mediaBatchCaption" rows="3" placeholder="Digite a mensagem que acompanhará a mídia..."></textarea>
                        </div>

                        <div class="form-group">
                            <label for="mediaDelay">Intervalo entre envios (ms):</label>
                            <input type="number" id="mediaDelay" value="3000" min="1000" max="60000">
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="cancelMediaBatchBtn">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Criar Lote de Mídia</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.currentModal = 'mediaBatchModal';

        // Configurar eventos de fechamento
        this.setupModalEvents();
        this.initMediaBatchForm();
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

    async initMediaBatchForm() {
        console.log('📝 Inicializando formulário do modal...');
        await this.loadInstancesToSelect();
        await this.loadGroupsToSelect();
        this.initFileUpload();
        
        document.getElementById('mediaBatchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('📤 Submetendo formulário...');
            this.createMediaBatch();
        });
    }

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
            this.handleFiles(e.dataTransfer.files);
        });
        
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }

    handleFiles(files) {
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            // Validar tamanho do arquivo (50MB máximo)
            if (file.size > 50 * 1024 * 1024) {
                this.safeShowNotification(`❌ Arquivo muito grande: ${file.name} (máximo 50MB)`, 'error');
                return;
            }

            // Validar tipo de arquivo
            const allowedTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
                'video/mp4', 'video/avi', 'video/mkv', 'video/quicktime', 
                'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 
                'application/pdf'
            ];
            
            if (!allowedTypes.includes(file.type)) {
                this.safeShowNotification(`❌ Tipo de arquivo não suportado: ${file.name}`, 'error');
                return;
            }

            // Adicionar arquivo à lista
            this.uploadedFiles.push(file);
            console.log(`✅ Arquivo adicionado: ${file.name}`);
        });

        this.updateFilesList();
    }

    updateFilesList() {
        const filePreview = document.getElementById('filePreview');
        if (!filePreview) return;

        filePreview.innerHTML = '';

        if (this.uploadedFiles.length === 0) {
            return;
        }

        this.uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="fas ${this.getFileIcon(file.type)}"></i>
                    <span>${file.name} (${this.formatFileSize(file.size)})</span>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="app.mediaBatchesManager.removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            filePreview.appendChild(fileItem);
        });
    }

    removeFile(index) {
        if (index >= 0 && index < this.uploadedFiles.length) {
            const removedFile = this.uploadedFiles.splice(index, 1)[0];
            console.log(`🗑️ Arquivo removido: ${removedFile.name}`);
            this.updateFilesList();
        }
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return 'fa-image';
        if (mimeType.startsWith('video/')) return 'fa-video';
        if (mimeType.startsWith('audio/')) return 'fa-music';
        if (mimeType === 'application/pdf') return 'fa-file-pdf';
        return 'fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async loadInstancesToSelect() {
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

    async loadGroupsToSelect() {
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
                container.innerHTML = '';
                
                if (response.contactGroups.length === 0) {
                    container.innerHTML = '<div class="no-groups">Nenhum grupo encontrado</div>';
                    return;
                }
                
                // Mostrar todos os grupos
                response.contactGroups.forEach(group => {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'checkbox-item';
                    
                    const contactCount = group.contacts ? group.contacts.length : 0;
                    const isEmpty = contactCount === 0;
                    
                    checkbox.innerHTML = `
                        <label>
                            <input type="checkbox" name="contactGroups" value="${group._id}" ${isEmpty ? 'disabled' : ''}>
                            <span class="${isEmpty ? 'empty-group' : ''}">
                                ${group.name} (${contactCount} contatos)
                                ${isEmpty ? ' - <em>vazio</em>' : ''}
                            </span>
                        </label>
                    `;
                    container.appendChild(checkbox);
                });
                
                console.log(`✅ Carregados ${response.contactGroups.length} grupos`);
                
                // Adicionar contador
                const totalGroups = response.contactGroups.length;
                const groupsWithContacts = response.contactGroups.filter(g => g.contacts && g.contacts.length > 0).length;
                
                const counter = document.createElement('div');
                counter.className = 'groups-counter';
                counter.innerHTML = `<strong>${groupsWithContacts}/${totalGroups}</strong> grupos com contatos`;
                container.appendChild(counter);
                
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

    async createMediaBatch() {
        try {
            this.safeShowLoading(true);
            
            // Validações
            if (this.uploadedFiles.length === 0) {
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

            console.log('📤 Iniciando upload de arquivos...');
            const mediaItems = [];
            
            for (const file of this.uploadedFiles) {
                const formData = new FormData();
                formData.append('mediaFiles', file);
                
                const uploadResponse = await this.safeApiRequest('POST', '/api/media/upload', formData, true);
                
                if (uploadResponse.success && uploadResponse.mediaItems) {
                    mediaItems.push(...uploadResponse.mediaItems);
                    console.log(`✅ Upload de ${file.name} concluído`);
                } else {
                    console.error(`❌ Falha no upload de ${file.name}:`, uploadResponse);
                    throw new Error(`Falha no upload do arquivo: ${file.name}`);
                }
            }

            if (mediaItems.length === 0) {
                this.safeShowNotification('❌ Erro ao fazer upload dos arquivos', 'error');
                this.safeShowLoading(false);
                return;
            }

            console.log('📦 Criando lote de mídia...');
            const batchData = {
                name: batchName,
                mediaItems: mediaItems,
                contactGroupIds: selectedGroups.map(cb => cb.value),
                whatsappInstanceId: instanceSelect.value,
                caption: document.getElementById('mediaBatchCaption').value,
                options: {
                    delayBetweenMessages: parseInt(document.getElementById('mediaDelay').value) || 3000,
                    sendAsDocument: false
                }
            };

            console.log('📋 Dados do lote:', batchData);
            const response = await this.safeApiRequest('POST', '/api/media/batches', batchData);
            
            if (response.success) {
                this.safeShowNotification('✅ Lote de mídia criado com sucesso!', 'success');
                this.safeCloseModal('mediaBatchModal');
                this.loadMediaBatches();
                this.uploadedFiles = [];
            } else {
                throw new Error(response.error || 'Erro desconhecido ao criar lote');
            }
        } catch (error) {
            console.error('Erro ao criar lote de mídia:', error);
            this.safeShowNotification(`❌ Erro: ${error.message}`, 'error');
        } finally {
            this.safeShowLoading(false);
        }
    }

    async loadMediaBatches() {
        try {
            const container = document.getElementById('mediaBatchesList');
            if (!container) return;

            container.innerHTML = '<div class="loading-text">Carregando lotes de mídia...</div>';
            const response = await this.safeApiRequest('GET', '/api/media/batches');
            
            if (response.success && response.batches && response.batches.length > 0) {
                container.innerHTML = this.renderMediaBatchesList(response.batches);
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-images"></i>
                        <p>Nenhum lote de mídia encontrado</p>
                        <button class="btn btn-primary" onclick="app.mediaBatchesManager.showMediaBatchModal()">
                            <i class="fas fa-plus"></i> Criar Primeiro Lote
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erro ao carregar lotes de mídia:', error);
            const container = document.getElementById('mediaBatchesList');
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erro ao carregar lotes de mídia</p>
                    </div>
                `;
            }
        }
    }

    renderMediaBatchesList(batches) {
        return `
            <div class="batches-grid">
                ${batches.map(batch => `
                    <div class="batch-card" data-batch-id="${batch._id}">
                        <div class="batch-header">
                            <h4>${batch.name}</h4>
                            <span class="batch-status ${batch.status}">${this.getStatusText(batch.status)}</span>
                        </div>
                        <div class="batch-info">
                            <div class="info-item">
                                <i class="fas fa-images"></i>
                                <span>${batch.mediaItems ? batch.mediaItems.length : 0} mídia(s)</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-users"></i>
                                <span>${batch.contactGroupIds ? batch.contactGroupIds.length : 0} grupo(s)</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-paper-plane"></i>
                                <span>${batch.sent || 0}/${batch.total || 0} enviados</span>
                            </div>
                        </div>
                        <div class="batch-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${this.calculateProgress(batch)}%"></div>
                            </div>
                            <span>${this.calculateProgress(batch)}%</span>
                        </div>
                        <div class="batch-actions">
                            ${batch.status === 'processing' ? `
                                <button class="btn btn-warning btn-sm" onclick="app.mediaBatchesManager.cancelBatch('${batch._id}')">
                                    <i class="fas fa-stop"></i> Cancelar
                                </button>
                            ` : ''}
                            <button class="btn btn-info btn-sm" onclick="app.mediaBatchesManager.viewBatchDetails('${batch._id}')">
                                <i class="fas fa-eye"></i> Detalhes
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="app.mediaBatchesManager.deleteBatch('${batch._id}')">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
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
        const total = batch.total || 0;
        const sent = batch.sent || 0;
        
        if (total === 0) return 0;
        return Math.round((sent / total) * 100);
    }

    async cancelBatch(batchId) {
        try {
            if (!confirm('Tem certeza que deseja cancelar este lote?')) return;
            
            const response = await this.safeApiRequest('PUT', `/api/media/batches/${batchId}/cancel`);
            
            if (response.success) {
                this.safeShowNotification('✅ Lote cancelado com sucesso', 'success');
                this.loadMediaBatches();
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
            
            const response = await this.safeApiRequest('DELETE', `/api/media/batches/${batchId}`);
            
            if (response.success) {
                this.safeShowNotification('✅ Lote excluído com sucesso', 'success');
                this.loadMediaBatches();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao excluir lote:', error);
            this.safeShowNotification(`❌ Erro: ${error.message}`, 'error');
        }
    }

    async viewBatchDetails(batchId) {
        try {
            const response = await this.safeApiRequest('GET', `/api/media/batches/${batchId}`);
            
            if (response.success) {
                this.showBatchDetailsModal(response.batch);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            this.safeShowNotification(`❌ Erro: ${error.message}`, 'error');
        }
    }

    showBatchDetailsModal(batch) {
        const modalHTML = `
            <div id="batchDetailsModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 900px;">
                    <span class="close" id="closeBatchDetailsModal">&times;</span>
                    <h3>Detalhes do Lote: ${batch.name}</h3>
                    <div class="batch-details">
                        <div class="detail-section">
                            <h4>Informações Gerais</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <strong>Status:</strong>
                                    <span class="status ${batch.status}">${this.getStatusText(batch.status)}</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Progresso:</strong>
                                    <span>${batch.sent || 0} / ${batch.total || 0}</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Mídias:</strong>
                                    <span>${batch.mediaItems ? batch.mediaItems.length : 0} arquivo(s)</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Grupos:</strong>
                                    <span>${batch.contactGroupIds ? batch.contactGroupIds.length : 0} grupo(s)</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Criado em:</strong>
                                    <span>${new Date(batch.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div class="detail-section">
                            <h4>Resultados</h4>
                            <div class="results-list">
                                ${this.renderResults(batch.results || [])}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar evento de fechamento
        document.getElementById('closeBatchDetailsModal').addEventListener('click', () => {
            this.safeCloseModal('batchDetailsModal');
        });
    }

    renderResults(results) {
        if (!results || results.length === 0) {
            return '<p class="no-results">Nenhum resultado disponível</p>';
        }
        
        return `
            <div class="results-table">
                ${results.slice(0, 50).map(result => `
                    <div class="result-item ${result.status}">
                        <div class="result-contact">${result.contact || 'N/A'} (${result.phone || 'N/A'})</div>
                        <div class="result-media">${result.mediaItem || 'N/A'}</div>
                        <div class="result-status">${result.status || 'N/A'}</div>
                        ${result.error ? `<div class="result-error">${result.error}</div>` : ''}
                    </div>
                `).join('')}
                ${results.length > 50 ? `<p class="more-results">... e mais ${results.length - 50} resultados</p>` : ''}
            </div>
        `;
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
        let totalPages = 1; // inicializa para entrar no loop

        while (currentPage <= totalPages) {
            const response = await this.safeApiRequest(
                'GET',
                `/api/contact-groups?page=${currentPage}&limit=100` // você pode ajustar o limit se a API permitir
            );

            if (response.success) {
                const groups = response.contactGroups || [];
                allGroups = allGroups.concat(groups);

                // atualiza totalPages com base na resposta
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

}