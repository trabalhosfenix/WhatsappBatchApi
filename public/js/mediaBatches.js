// 📁 js/mediaBatches.js
class MediaBatchesManager {
    constructor() {
        this.uploadedFiles = [];
        this.initEvents();
    }

    initEvents() {
        // Botão para adicionar lote de mídia
        document.getElementById('addMediaBatchBtn')?.addEventListener('click', () => {
            this.showMediaBatchModal();
        });

        // Carregar lotes de mídia quando a seção for ativada
        document.addEventListener('sectionChanged', (event) => {
            if (event.detail.section === 'mediaBatchesSection') {
                this.loadMediaBatches();
            }
        });
    }

    async showMediaBatchModal() {
        // Verificar se há instâncias conectadas
        const instances = await this.getConnectedInstances();
        if (instances.length === 0) {
            showNotification('⚠️ É necessário ter uma instância WhatsApp conectada', 'warning');
            return;
        }

        // Verificar se há grupos de contatos
        const groups = await this.getContactGroups();
        if (groups.length === 0) {
            showNotification('⚠️ É necessário criar grupos de contatos primeiro', 'warning');
            return;
        }

        this.createMediaBatchModal();
    }

    createMediaBatchModal() {
        const modalHTML = `
            <div id="mediaBatchModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 800px;">
                    <span class="close" onclick="closeModal('mediaBatchModal')">&times;</span>
                    <h3>Novo Envio de Mídia em Lote</h3>
                    
                    <form id="mediaBatchForm">
                        <div class="form-group">
                            <label for="mediaBatchName">Nome do Lote:</label>
                            <input type="text" id="mediaBatchName" placeholder="Ex: Promoção de Verão" required>
                        </div>

                        <div class="form-group">
                            <label for="mediaBatchInstance">Instância WhatsApp:</label>
                            <select id="mediaBatchInstance" required>
                                <option value="">Selecione uma instância...</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Grupos de Contatos:</label>
                            <div id="mediaBatchGroups" class="checkbox-group">
                                <!-- Grupos serão carregados aqui -->
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Arquivos de Mídia:</label>
                            <div id="mediaFilesContainer">
                                <div class="file-upload-area" id="mediaUploadArea">
                                    <i class="fas fa-cloud-upload-alt" style="font-size: 48px; color: #666; margin-bottom: 15px;"></i>
                                    <p>Clique para selecionar arquivos ou arraste e solte aqui</p>
                                    <p class="file-types">Tipos suportados: Imagens, Vídeos, Áudio, PDF</p>
                                    <input type="file" id="mediaFilesInput" multiple accept="image/*,video/*,audio/*,application/pdf" style="display: none;">
                                </div>
                                <div id="mediaFilesList" class="files-list" style="margin-top: 15px;"></div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="mediaDelay">Intervalo entre envios (ms):</label>
                            <input type="number" id="mediaDelay" value="3000" min="1000" max="10000">
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('mediaBatchModal')">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Criar Lote de Mídia</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Adicionar modal ao body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.initMediaBatchForm();
    }

    async initMediaBatchForm() {
        // Carregar instâncias
        await this.loadInstancesToSelect();
        
        // Carregar grupos
        await this.loadGroupsToSelect();

        // Configurar upload de arquivos
        this.initFileUpload();

        // Configurar formulário
        document.getElementById('mediaBatchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createMediaBatch();
        });
    }

    initFileUpload() {
        const uploadArea = document.getElementById('mediaUploadArea');
        const fileInput = document.getElementById('mediaFilesInput');
        const filesList = document.getElementById('mediaFilesList');

        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '#f0f8ff';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.backgroundColor = '';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '';
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }

    handleFiles(files) {
        const filesList = document.getElementById('mediaFilesList');
        
        Array.from(files).forEach(file => {
            // Validar tamanho (50MB)
            if (file.size > 50 * 1024 * 1024) {
                showNotification(`❌ Arquivo muito grande: ${file.name} (máximo 50MB)`, 'error');
                return;
            }

            // Validar tipo
            const allowedTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'video/mp4', 'video/avi', 'video/mkv', 'video/quicktime',
                'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
                'application/pdf'
            ];

            if (!allowedTypes.includes(file.type)) {
                showNotification(`❌ Tipo de arquivo não suportado: ${file.name}`, 'error');
                return;
            }

            // Adicionar à lista
            this.uploadedFiles.push(file);
            this.updateFilesList();
        });
    }

    updateFilesList() {
        const filesList = document.getElementById('mediaFilesList');
        filesList.innerHTML = '';

        this.uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="fas ${this.getFileIcon(file.type)}"></i>
                    <span>${file.name} (${this.formatFileSize(file.size)})</span>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="mediaBatchesManager.removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            filesList.appendChild(fileItem);
        });
    }

    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        this.updateFilesList();
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
            select.innerHTML = '<option value="">Selecione uma instância...</option>';

            const response = await apiRequest('GET', '/api/whatsapp/instances');
            if (response.success) {
                response.instances
                    .filter(instance => instance.status === 'connected')
                    .forEach(instance => {
                        const option = document.createElement('option');
                        option.value = instance._id;
                        option.textContent = `${instance.sessionName} (${instance.phoneNumber || 'Não conectado'})`;
                        select.appendChild(option);
                    });
            }
        } catch (error) {
            console.error('Erro ao carregar instâncias:', error);
        }
    }

    async loadGroupsToSelect() {
        try {
            const container = document.getElementById('mediaBatchGroups');
            container.innerHTML = '';

            const response = await apiRequest('GET', '/api/contact-groups');
            if (response.success) {
                response.contactGroups.forEach(group => {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'checkbox-item';
                    checkbox.innerHTML = `
                        <label>
                            <input type="checkbox" name="contactGroups" value="${group._id}">
                            ${group.name} (${group.contactCount} contatos)
                        </label>
                    `;
                    container.appendChild(checkbox);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar grupos:', error);
        }
    }

    async createMediaBatch() {
        try {
            showLoading(true);

            // Validar arquivos
            if (this.uploadedFiles.length === 0) {
                showNotification('❌ Selecione pelo menos um arquivo de mídia', 'error');
                showLoading(false);
                return;
            }

            // Upload dos arquivos
            const mediaItems = [];
            for (const file of this.uploadedFiles) {
                const formData = new FormData();
                formData.append('mediaFiles', file);
                
                const uploadResponse = await apiRequest('POST', '/api/media/upload', formData, true);
                if (uploadResponse.success && uploadResponse.mediaItems) {
                    mediaItems.push(...uploadResponse.mediaItems);
                }
            }

            if (mediaItems.length === 0) {
                showNotification('❌ Erro ao fazer upload dos arquivos', 'error');
                showLoading(false);
                return;
            }

            // Coletar dados do formulário
            const formData = {
                name: document.getElementById('mediaBatchName').value,
                mediaItems: mediaItems,
                contactGroupIds: Array.from(document.querySelectorAll('input[name="contactGroups"]:checked'))
                    .map(cb => cb.value),
                whatsappInstanceId: document.getElementById('mediaBatchInstance').value,
                options: {
                    delayBetweenMessages: parseInt(document.getElementById('mediaDelay').value) || 3000,
                    sendAsDocument: false
                }
            };

            // Criar lote
            const response = await apiRequest('POST', '/api/media/batches', formData);
            
            if (response.success) {
                showNotification('✅ Lote de mídia criado com sucesso!', 'success');
                closeModal('mediaBatchModal');
                this.loadMediaBatches();
                this.uploadedFiles = []; // Limpar arquivos
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('Erro ao criar lote de mídia:', error);
            showNotification(`❌ Erro: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }

    async loadMediaBatches() {
        try {
            const container = document.getElementById('mediaBatchesList');
            container.innerHTML = '<div class="loading-text">Carregando lotes de mídia...</div>';

            const response = await apiRequest('GET', '/api/media/batches');
            
            if (response.success && response.batches.length > 0) {
                container.innerHTML = this.renderMediaBatchesList(response.batches);
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-images" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                        <p>Nenhum lote de mídia encontrado</p>
                        <button class="btn btn-primary" onclick="mediaBatchesManager.showMediaBatchModal()">
                            <i class="fas fa-plus"></i> Criar Primeiro Lote
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erro ao carregar lotes de mídia:', error);
            document.getElementById('mediaBatchesList').innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar lotes de mídia</p>
                </div>
            `;
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
                                <span>${batch.mediaCount} mídia(s)</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-users"></i>
                                <span>${batch.contactGroups?.length || 0} grupo(s)</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-paper-plane"></i>
                                <span>${batch.sent || 0}/${batch.totalSends || 0} enviados</span>
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
                                <button class="btn btn-warning btn-sm" onclick="mediaBatchesManager.cancelBatch('${batch._id}')">
                                    <i class="fas fa-stop"></i> Cancelar
                                </button>
                            ` : ''}
                            
                            <button class="btn btn-info btn-sm" onclick="mediaBatchesManager.viewBatchDetails('${batch._id}')">
                                <i class="fas fa-eye"></i> Detalhes
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
        if (!batch.totalSends || batch.totalSends === 0) return 0;
        return Math.round(((batch.sent || 0) / batch.totalSends) * 100);
    }

    async cancelBatch(batchId) {
        try {
            if (!confirm('Tem certeza que deseja cancelar este lote?')) return;

            const response = await apiRequest('PUT', `/api/media/batches/${batchId}/cancel`);
            
            if (response.success) {
                showNotification('✅ Lote cancelado com sucesso', 'success');
                this.loadMediaBatches();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao cancelar lote:', error);
            showNotification(`❌ Erro: ${error.message}`, 'error');
        }
    }

    async viewBatchDetails(batchId) {
        try {
            const response = await apiRequest('GET', `/api/media/batches/${batchId}`);
            
            if (response.success) {
                this.showBatchDetailsModal(response.batch);
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            showNotification(`❌ Erro: ${error.message}`, 'error');
        }
    }

    showBatchDetailsModal(batch) {
        const modalHTML = `
            <div id="batchDetailsModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 900px;">
                    <span class="close" onclick="closeModal('batchDetailsModal')">&times;</span>
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
                                    <span>${batch.progress?.sent || 0} / ${batch.progress?.total || 0}</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Mídias:</strong>
                                    <span>${batch.mediaItems?.length || 0} arquivo(s)</span>
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
    }

    renderResults(results) {
        if (!results || results.length === 0) {
            return '<p class="no-results">Nenhum resultado disponível</p>';
        }

        return `
            <div class="results-table">
                ${results.slice(0, 50).map(result => `
                    <div class="result-item ${result.status}">
                        <div class="result-contact">${result.contact} (${result.phone})</div>
                        <div class="result-media">${result.mediaItem}</div>
                        <div class="result-status">${result.status}</div>
                        ${result.error ? `<div class="result-error">${result.error}</div>` : ''}
                    </div>
                `).join('')}
                ${results.length > 50 ? `<p class="more-results">... e mais ${results.length - 50} resultados</p>` : ''}
            </div>
        `;
    }

    async getConnectedInstances() {
        try {
            const response = await apiRequest('GET', '/api/whatsapp/instances');
            return response.success ? response.instances.filter(i => i.status === 'connected') : [];
        } catch (error) {
            return [];
        }
    }

    async getContactGroups() {
        try {
            const response = await apiRequest('GET', '/api/contact-groups');
            return response.success ? response.contactGroups : [];
        } catch (error) {
            return [];
        }
    }
}

// Inicializar manager
const mediaBatchesManager = new MediaBatchesManager();