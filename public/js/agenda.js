// 📁 js/agenda.js (ATUALIZADO COM APIREQUEST)
class AgendaManager {
    constructor(auth) {
        this.auth = auth;
        this.currentSection = 'contactsSection';
        this.contacts = [];
        this.groups = [];
        this.contactGroups = [];
        this.instances = [];
        this.filters = {
            search: '',
            platform: '',
            group: '',
            sort: 'name'
        };
    }

    init() {
        console.log('📍 Inicializando AgendaManager...');

        if (!this.checkAuth()) {
            return false;
        }

        this.setupEventListeners();
        this.loadInitialData();
        this.updateUserProfile();

        // ✅ DEBUG TEMPORÁRIO
        setTimeout(() => {
            this.debugCheckData();
        }, 1000);

        return true;
    }

    checkAuth() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.error('❌ Usuário não autenticado');
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    showNewGroupModal() {
        // Remove modal anterior, se existir
        const existingModal = document.getElementById('newGroupModal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
    <div id="newGroupModal" class="modal">
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Criar Novo Grupo</h3>

            <form id="newGroupForm">
                <label>Nome do Grupo:</label>
                <input type="text" id="groupNameInput" required placeholder="Ex: Clientes VIP">

                <label>Descrição (opcional):</label>
                <textarea id="groupDescriptionInput" placeholder="Descrição do grupo"></textarea>

                <label>Instância WhatsApp:</label>
                <select id="groupInstanceSelect" required>
                    <option value="">Selecione a instância</option>
                    ${this.instances.map(i => `
                        <option value="${i._id}">${i.sessionName}</option>
                    `).join('')}
                </select>

                <button type="submit" class="btn btn-primary" style="margin-top: 15px;">
                    <i class="fas fa-check"></i> Criar Grupo
                </button>
            </form>
        </div>
    </div>
    `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('newGroupModal');

        modal.querySelector('.close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('newGroupForm').addEventListener('submit', (e) => this.saveNewGroup(e));

        modal.style.display = 'block';
    }


    // ✅ MÉTODO APIREQUEST INTEGRADO
    async apiRequest(endpoint, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Usuário não autenticado');
        }

        const token = localStorage.getItem('authToken');
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            console.log(`🌐 API Request: ${endpoint}`);
            this.auth.showLoading();

            const response = await fetch(endpoint, mergedOptions);

            if (response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
                window.location.href = 'index.html';
                throw new Error('Sessão expirada');
            }

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errBody = await response.json();
                    if (errBody && errBody.error) errorMsg = errBody.error;
                } catch { }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Erro na requisição API:', error);

            if (error.message.includes('Failed to fetch')) {
                this.auth.showNotification('Erro de conexão com o servidor', 'error');
            } else if (error.message.includes('401')) {
                this.auth.showNotification('Sessão expirada. Faça login novamente.', 'error');
            } else {
                this.auth.showNotification(error.message, 'error');
            }

            throw error;
        } finally {
            this.auth.hideLoading();
        }
    }

    isAuthenticated() {
        const token = localStorage.getItem('authToken');
        return !!token;
    }

    async saveNewGroup(e) {
        e.preventDefault();

        const name = document.getElementById('groupNameInput').value.trim();
        const description = document.getElementById('groupDescriptionInput').value.trim();
        const instanceId = document.getElementById('groupInstanceSelect').value;

        if (!name || !instanceId) {
            this.auth.showNotification('Preencha o nome e a instância.', 'error');
            return;
        }

        try {
            const body = {
                name,
                description,
                instanceId
            };

            const data = await this.apiRequest('/api/contact-groups', {
                method: 'POST',
                body: JSON.stringify(body)
            });

            if (data.success) {
                this.auth.showNotification('Grupo criado com sucesso!', 'success');

                // Fechar modal
                document.getElementById('newGroupModal')?.remove();

                // Recarregar lista de grupos
                await this.loadContactGroups();
            } else {
                throw new Error(data.error || "Erro ao criar grupo");
            }

        } catch (error) {
            console.error("❌ Erro ao criar grupo:", error);
            this.auth.showNotification(error.message, 'error');
        }
    }


    setupEventListeners() {
        // Navegação entre seções
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.currentTarget.dataset.section);
            });
        });

        // Botões de contatos
        document.getElementById('loadContactsBtn')?.addEventListener('click', () => this.loadContacts());
        document.getElementById('loadContactsInitialBtn')?.addEventListener('click', () => this.loadContacts());
        document.getElementById('addContactBtn')?.addEventListener('click', () => this.showNewContactModal());

        // Botões de grupos
        document.getElementById('loadGroupsBtn')?.addEventListener('click', () => this.loadGroups());
        document.getElementById('loadGroupsInitialBtn')?.addEventListener('click', () => this.loadGroups());

        // Filtros e busca
        document.getElementById('searchContacts')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.filterContacts();
        });

        document.getElementById('filterPlatform')?.addEventListener('change', (e) => {
            this.filters.platform = e.target.value;
            this.filterContacts();
        });

        document.getElementById('filterGroup')?.addEventListener('change', (e) => {
            this.filters.group = e.target.value;
            this.filterContacts();
        });

        document.getElementById('sortContacts')?.addEventListener('change', (e) => {
            this.filters.sort = e.target.value;
            this.sortContacts();
        });

        // Filtros de grupos
        document.getElementById('searchGroups')?.addEventListener('input', (e) => {
            this.filterGroups(e.target.value);
        });
        document.getElementById('filterGroupPlatform')?.addEventListener('change', (e) => {
            this.filterGroupsByPlatform(e.target.value);
        });
        document.getElementById('filterGroupInstance')?.addEventListener('change', (e) => {
            this.filterGroupsByInstance(e.target.value);
        });
        document.getElementById('sortGroups')?.addEventListener('change', (e) => {
            this.sortGroups(e.target.value);
        });

        // Modal de novo contato
        document.getElementById('newContactForm')?.addEventListener('submit', (e) => this.saveNewContact(e));

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // Fechar modais
        document.querySelectorAll('.modal .close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });
    }

    switchSection(sectionId) {
        // Esconder todas as seções
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Mostrar seção selecionada
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionId;
        }

        // Atualizar botões de navegação
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
    }

    async loadInitialData() {
        await this.loadInstances();
        await this.loadContactGroupsForFilter();
    }

    async loadContactGroupsForFilter() {
        try {
            const data = await this.apiRequest('/api/contact-groups');
            this.contactGroups = data.groups || [];
            this.updateGroupFilters();
        } catch (error) {
            console.error('❌ Erro ao carregar grupos de contatos:', error);
            this.contactGroups = [];
        }
    }

    async loadInstances() {
        try {
            // ✅ USANDO APIREQUEST
            const data = await this.apiRequest('/api/whatsapp/instances');
            this.instances = data.instances || [];
            this.updateInstanceFilters();
        } catch (error) {
            console.error('❌ Erro ao carregar instâncias:', error);
        }
    }

    updateInstanceFilters() {
        const instanceFilter = document.getElementById('filterGroupInstance');
        if (instanceFilter) {
            instanceFilter.innerHTML = '<option value="">Todas as Instâncias</option>';
            this.instances.forEach(instance => {
                const option = document.createElement('option');
                option.value = instance._id;
                option.textContent = instance.sessionName;
                instanceFilter.appendChild(option);
            });
        }
    }

    async loadContacts() {
        try {
            // ✅ USANDO APIREQUEST
            const data = await this.apiRequest('/api/participants');

            // ✅ DEBUG - Verificar estrutura dos dados
            console.log('🔍 DEBUG - Resposta da API:', {
                success: data.success,
                totalParticipants: data.participants ? data.participants.length : 0,
                firstParticipant: data.participants ? data.participants[0] : null,
                statistics: data.statistics
            });

            if (data.success) {
                // ✅ MAPEAR CORRETAMENTE OS CAMPOS DOS PARTICIPANTS COM INFORMAÇÕES DE GRUPOS
                this.contacts = (data.participants || []).map(participant => {
                    // Usar os campos exatos do controller
                    return {
                        id: participant.id || participant._id,
                        name: participant.name || participant.pushName || 'Nome não disponível',
                        phone: participant.phone || participant.phoneNumber || '',
                        whatsappId: participant.whatsappId || participant.participantId || '',
                        messageCount: participant.messageCount || 0,
                        isActive: participant.isActive !== undefined ? participant.isActive : true,
                        lastActivity: participant.lastActivity || participant.lastMessageTimestamp,
                        source: participant.source || 'whatsapp',
                        // ✅ NOVOS CAMPOS PARA GRUPOS
                        groups: participant.groups || [],
                        groupCount: participant.groupCount || 0,
                        adminGroups: participant.adminGroups || 0,
                        // Campos adicionais para compatibilidade
                        remoteJid: participant.remoteJid,
                        isBusiness: participant.isBusiness || false
                    };
                });

                this.renderContacts();
                this.updateContactsStats(data.statistics);

                this.auth.showNotification(`${this.contacts.length} contatos carregados com sucesso`, 'success');
            } else {
                throw new Error(data.error || 'Erro ao carregar contatos');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar contatos:', error);
        }
    }

    renderContacts() {
        const container = document.getElementById('contactsList');
        if (!container) return;

        if (this.contacts.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-address-book"></i>
            <h3>Nenhum contato encontrado</h3>
            <p>Nenhum contato foi carregado das suas instâncias</p>
            <button id="loadContactsInitialBtn" class="btn btn-primary">
                <i class="fas fa-download"></i>
                Carregar Contatos
            </button>
        </div>
    `;

            document.getElementById('loadContactsInitialBtn')?.addEventListener('click', () => this.loadContacts());
            return;
        }

        container.innerHTML = this.contacts.map(contact => {
            // ✅ VALIDAÇÃO ROBUSTA DE TODOS OS CAMPOS
            const contactId = contact.id || 'unknown';
            const contactName = this.escapeHtml(contact.name || 'Sem nome');
            const contactPhone = this.formatPhone(contact.phone || '');
            const whatsappId = contact.whatsappId || '';
            const messageCount = contact.messageCount || 0;
            const isActive = contact.isActive !== false;
            const lastActivity = contact.lastActivity ? this.formatDate(contact.lastActivity) : null;
            const source = contact.source || 'whatsapp';

            // ✅ NOVAS INFORMAÇÕES DE GRUPOS
            const groupCount = contact.groupCount || 0;
            const adminGroups = contact.adminGroups || 0;
            const groups = contact.groups || [];

            // ✅ GERAR HTML DOS GRUPOS
            const groupsHtml = this.generateGroupsHtml(groups, groupCount, adminGroups);

            return `
        <div class="contact-card" data-contact-id="${contactId}" data-source="${source}">
            <div class="contact-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="contact-info">
                <h4 class="contact-name"> 👤 ${contactName}</h4>
                <p class="contact-phone">📱 ${contactPhone}</p>
                ${whatsappId ? `<p class="contact-waid">🔑 ${whatsappId}</p>` : ''}
                
                <!-- ✅ NOVA SEÇÃO DE GRUPOS -->
                <div class="contact-groups-section">
                    ${groupsHtml}
                </div>
                
                ${messageCount > 0 ? `<span class="message-badge">✉️ ${messageCount} mensagens</span>` : ''}    
                ${isActive ? `<span class="active-badge">Ativo</span>` : '<span class="inactive-badge">Inativo</span>'}
                ${source === 'manual' ? `<span class="manual-badge">Manual</span>` : ''}
                ${lastActivity ? `<p class="contact-activity">Última atividade: ${lastActivity}</p>` : ''}
            </div>
            <div class="contact-actions">
                <button class="btn-icon" onclick="agendaManager.sendMessage('${contact.phone}')" title="Enviar mensagem">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="btn-icon" onclick="agendaManager.viewContactDetails('${contactId}')" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                ${groupCount > 0 ? `
                <button class="btn-icon" onclick="agendaManager.viewContactGroups('${contactId}')" title="Ver grupos">
                    <i class="fas fa-users"></i>
                </button>
                ` : ''}
            </div>
        </div>
    `;
        }).join('');
    }

    async loadContactGroups() {
        try {
            // ✅ USANDO APIREQUEST
            const data = await this.apiRequest('/api/contact-groups');
            this.groups = data.groups || [];
            this.updateGroupFilters();
        } catch (error) {
            console.error('❌ Erro ao carregar grupos:', error);
        }
    }

    // Adicione este método à classe AgendaManager para debug
    debugParticipants(data) {
        console.log('🔍 DEBUG - Estrutura dos participants:', {
            success: data.success,
            total: data.participants ? data.participants.length : 0,
            firstParticipant: data.participants ? data.participants[0] : null,
            statistics: data.statistics
        });

        if (data.participants && data.participants.length > 0) {
            console.log('📋 Campos disponíveis no primeiro participant:', Object.keys(data.participants[0]));
        }
    }

    generateGroupsHtml(groups, groupCount, adminGroups) {
        if (groupCount === 0) {
            return `
            <div class="groups-info">
                <span class="groups-badge no-groups">
                    <i class="fas fa-users"></i>
                    Não participa de grupos
                </span>
            </div>
        `;
        }

        let groupsHtml = '';

        // Se houver grupos específicos, mostrar os primeiros 3
        if (groups && groups.length > 0) {
            const displayedGroups = groups.slice(0, 3);
            const remainingGroups = groups.length - 3;

            groupsHtml = `
            <div class="groups-list">
                ${displayedGroups.map(group => `
                    <span class="group-tag ${group.role === 'admin' || group.role === 'superadmin' ? 'admin-group' : ''}" 
                          title="${this.escapeHtml(group.name)} - ${group.role}">
                        <i class="fas ${group.role === 'admin' || group.role === 'superadmin' ? 'fa-crown' : 'fa-user'}"></i>
                        ${this.truncateText(group.name, 15)}
                    </span>
                `).join('')}
                ${remainingGroups > 0 ? `
                    <span class="group-tag more-groups" title="Mais ${remainingGroups} grupos">
                        +${remainingGroups}
                    </span>
                ` : ''}
            </div>
        `;
        }

        return `
        <div class="groups-info">
            <div class="groups-summary">
                <span class="groups-badge">
                    <i class="fas fa-users"></i>
                    ${groupCount} grupo${groupCount !== 1 ? 's' : ''}
                </span>
                ${adminGroups > 0 ? `
                    <span class="admin-badge">
                        <i class="fas fa-crown"></i>
                        Admin em ${adminGroups}
                    </span>
                ` : ''}
            </div>
            ${groupsHtml}
        </div>
    `;
    }
    async viewContactGroups(contactId) {
        try {
            const contact = this.contacts.find(c => c.id === contactId);
            if (!contact) {
                this.auth.showNotification('Contato não encontrado', 'error');
                return;
            }

            // Buscar informações detalhadas dos grupos
            const data = await this.apiRequest(`/api/participants/${contactId}/groups`);

            if (data.success) {
                this.showContactGroupsModal(contact, data.groups);
            } else {
                throw new Error(data.error || 'Erro ao carregar grupos');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar grupos do contato:', error);
            this.auth.showNotification('Erro ao carregar grupos', 'error');
        }
    }

    showContactGroupsModal(contact, groups) {
        const modalHtml = `
        <div id="contactGroupsModal" class="modal">
            <div class="modal-content">
                <span class="close">&times;</span>
                <div class="modal-header">
                    <h3>Grupos de ${this.escapeHtml(contact.name)}</h3>
                    <p>Participa de ${groups.length} grupos</p>
                </div>
                <div class="modal-body">
                    <div class="groups-stats">
                        <div class="stat-item">
                            <span class="stat-number">${groups.length}</span>
                            <span class="stat-label">Total de Grupos</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${groups.filter(g => g.role === 'admin' || g.role === 'superadmin').length}</span>
                            <span class="stat-label">Como Admin</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${groups.filter(g => g.isActive).length}</span>
                            <span class="stat-label">Grupos Ativos</span>
                        </div>
                    </div>
                    
                    <div class="groups-list-detailed">
                        ${groups.length > 0 ? groups.map(group => `
                            <div class="group-item ${group.role === 'admin' || group.role === 'superadmin' ? 'admin-role' : 'member-role'}">
                                <div class="group-icon">
                                    <i class="fas ${group.role === 'admin' || group.role === 'superadmin' ? 'fa-crown' : 'fa-user'}"></i>
                                </div>
                                <div class="group-details">
                                    <h4>${this.escapeHtml(group.name)}</h4>
                                    <p class="group-meta">
                                        <span class="role-badge ${group.role}">${group.role === 'admin' || group.role === 'superadmin' ? 'Administrador' : 'Membro'}</span>
                                        <span class="participant-count">${group.participantCount || 0} membros</span>
                                        ${group.joinedAt ? `<span class="joined-date">Entrou em ${this.formatDate(group.joinedAt)}</span>` : ''}
                                    </p>
                                    ${group.description ? `<p class="group-description">${this.escapeHtml(group.description)}</p>` : ''}
                                </div>
                                <div class="group-actions">
                                    <button class="btn btn-sm btn-outline" onclick="agendaManager.viewGroupDetails('${group.id}')">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('') : `
                            <div class="empty-state">
                                <i class="fas fa-users"></i>
                                <p>Este contato não participa de nenhum grupo</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;

        // Remover modal existente
        const existingModal = document.getElementById('contactGroupsModal');
        if (existingModal) existingModal.remove();

        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('contactGroupsModal');

        // Configurar eventos
        modal.querySelector('.close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        modal.style.display = 'block';
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return this.escapeHtml(text);
        return this.escapeHtml(text.substring(0, maxLength)) + '...';
    }


    updateGroupFilters() {
        const groupFilter = document.getElementById('filterGroup');
        if (groupFilter && this.contactGroups) {
            groupFilter.innerHTML = '<option value="">Todos os Grupos</option>';
            this.contactGroups.forEach(group => {
                const option = document.createElement('option');
                option.value = group._id;
                option.textContent = group.name;
                groupFilter.appendChild(option);
            });
        }

        const groupsSelect = document.getElementById('newContactGroups');
        if (groupsSelect && this.contactGroups) {
            groupsSelect.innerHTML = this.contactGroups.map(group =>
                `<option value="${group._id}">${this.escapeHtml(group.name)}</option>`
            ).join('');
        }
    }

    filterContacts() {
        let filtered = [...this.contacts];

        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            filtered = filtered.filter(contact =>
                (contact.name || '').toLowerCase().includes(searchTerm) ||
                (contact.phone || '').includes(searchTerm) ||
                (contact.whatsappId && contact.whatsappId.toLowerCase().includes(searchTerm))
            );
        }

        if (this.filters.platform) {
            filtered = filtered.filter(contact => contact.source === this.filters.platform);
        }

        if (this.filters.group && this.contactGroups) {
            const selectedGroup = this.contactGroups.find(g => g._id === this.filters.group);
            if (selectedGroup) {
                filtered = filtered.filter(contact => {
                    const groups = contact.groups || [];
                    return groups.some(g => g.groupId === this.filters.group || g.id === this.filters.group || g.jid === selectedGroup.jid);
                });
            }
        }

        this.sortContacts(filtered);
    }

    async debugCheckData() {
        try {
            console.log('🔍 Iniciando debug...');

            // Teste 1: Rota básica
            const testData = await this.apiRequest('/api/participants/debug/test');
            console.log('✅ Rota básica:', testData);

            // Teste 2: Rota de debug
            const debugData = await this.apiRequest('/api/participants/debug/check-data');
            console.log('✅ Dados de debug:', debugData);

            if (debugData.success) {
                this.auth.showNotification(
                    `Debug: ${debugData.debug.userParticipantsCount} participants encontrados`,
                    'info'
                );
            }
        } catch (error) {
            console.error('❌ Erro no debug:', error);
            this.auth.showNotification('Erro no debug - verifique o console do servidor', 'error');
        }
    }

    sortContacts(contacts = null) {
        const contactsToSort = contacts || [...this.contacts];

        switch (this.filters.sort) {
            case 'name':
                contactsToSort.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'recent':
                contactsToSort.sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
                break;
            case 'activity':
                contactsToSort.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
                break;
        }

        this.renderSpecificContacts(contactsToSort);
    }


    renderSpecificContacts(contacts) {
        const container = document.getElementById('contactsList');
        if (!container) return;

        if (contacts.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h3>Nenhum contato encontrado</h3>
            <p>Tente ajustar os filtros de busca</p>
        </div>
    `;
            return;
        }

        container.innerHTML = contacts.map(contact => {
            const contactId = contact.id || 'unknown';
            const contactName = this.escapeHtml(contact.name || 'Sem nome');
            const contactPhone = this.formatPhone(contact.phone || '');
            const whatsappId = contact.whatsappId || '';
            const messageCount = contact.messageCount || 0;
            const isActive = contact.isActive !== false;
            const source = contact.source || 'whatsapp';

            // ✅ NOVAS INFORMAÇÕES DE GRUPOS
            const groupCount = contact.groupCount || 0;
            const adminGroups = contact.adminGroups || 0;
            const groups = contact.groups || [];

            // ✅ GERAR HTML DOS GRUPOS
            const groupsHtml = this.generateGroupsHtml(groups, groupCount, adminGroups);

            return `
        <div class="contact-card" data-contact-id="${contactId}" data-source="${source}">
            <div class="contact-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="contact-info">
                <h4 class="contact-name">👤 ${contactName}</h4>
                <p class="contact-phone">📱 ${contactPhone}</p>
                ${whatsappId ? `<p class="contact-waid">🔑 ${whatsappId}</p>` : ''}
                
                <!-- ✅ NOVA SEÇÃO DE GRUPOS -->
                <div class="contact-groups-section">
                    ${groupsHtml}
                </div>
                
                ${messageCount > 0 ? `<span class="message-badge">✉️ ${messageCount} mensagens</span>` : ''}
                ${isActive ? `<span class="active-badge">Ativo</span>` : '<span class="inactive-badge">Inativo</span>'}
                ${source === 'manual' ? `<span class="manual-badge">Manual</span>` : ''}
            </div>
            <div class="contact-actions">
                <button class="btn-icon" onclick="agendaManager.sendMessage('${contact.phone}')" title="Enviar mensagem">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="btn-icon" onclick="agendaManager.viewContactDetails('${contactId}')" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                ${groupCount > 0 ? `
                <button class="btn-icon" onclick="agendaManager.viewContactGroups('${contactId}')" title="Ver grupos">
                    <i class="fas fa-users"></i>
                </button>
                ` : ''}
            </div>
        </div>
    `;
        }).join('');
    }

    async loadGroups() {
        try {
            // ✅ USANDO APIREQUEST PARA CADA INSTÂNCIA
            const allGroups = [];

            for (const instance of this.instances) {
                if (instance.status === 'connected') {
                    try {
                        const data = await this.apiRequest(`/api/whatsapp/instances/${instance._id}/groups`);
                        if (data.success) {
                            allGroups.push(...data.groups);
                        }
                    } catch (error) {
                        console.warn(`⚠️ Não foi possível carregar grupos da instância ${instance.sessionName}:`, error);
                    }
                }
            }

            this.groups = allGroups;
            this.renderGroups();

            this.auth.showNotification(`${allGroups.length} grupos carregados com sucesso`, 'success');

        } catch (error) {
            console.error('❌ Erro ao carregar grupos:', error);
        }
    }

    renderGroups() {
        const container = document.getElementById('groupsList');
        if (!container) return;

        if (this.groups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-layer-group"></i>
                    <h3>Nenhum grupo encontrado</h3>
                    <p>Nenhum grupo foi carregado das suas instâncias</p>
                    <button id="loadGroupsInitialBtn" class="btn btn-primary">
                        <i class="fas fa-download"></i>
                        Carregar Grupos
                    </button>
                </div>
            `;

            document.getElementById('loadGroupsInitialBtn')?.addEventListener('click', () => this.loadGroups());
            return;
        }

        container.innerHTML = this.groups.map(group => `
            <div class="group-card" data-platform="${group.source || 'manual'}" data-instance-id="${group.whatsappInstanceId || ''}">
                <div class="group-header">
                    <div class="group-avatar">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="group-info">
                        <h4 class="group-name">${this.escapeHtml(group.name)}</h4>
                        ${group.description ? `<p class="group-description">${this.escapeHtml(group.description)}</p>` : ''}
                        <div class="group-stats">
                            <span class="stat">
                                <i class="fas fa-user-friends"></i>
                                ${group.participantCount || group.contactCount || 0} membros
                            </span>
                            <span class="stat platform-badge">
                                ${group.source === 'manual' ? 'Manual' : 'WhatsApp'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="group-actions">
                    <button class="btn btn-sm btn-outline" onclick="agendaManager.viewGroupDetails('${group._id}')">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="agendaManager.sendGroupMessage('${group._id}')">
                        <i class="fas fa-comment"></i> Mensagem
                    </button>
                </div>
            </div>
        `).join('');
    }

    filterGroups(searchTerm) {
        const container = document.getElementById('groupsList');
        if (!container) return;

        const groupCards = container.querySelectorAll('.group-card');
        groupCards.forEach(card => {
            const groupName = card.querySelector('.group-name').textContent.toLowerCase();
            const shouldShow = groupName.includes((searchTerm || '').toLowerCase());
            card.style.display = shouldShow ? 'block' : 'none';
        });
    }

    filterGroupsByPlatform(platform) {
        const container = document.getElementById('groupsList');
        if (!container) return;
        const groupCards = container.querySelectorAll('.group-card');
        groupCards.forEach(card => {
            const shouldShow = !platform || card.dataset.platform === platform;
            card.style.display = shouldShow ? 'block' : 'none';
        });
    }

    filterGroupsByInstance(instanceId) {
        const container = document.getElementById('groupsList');
        if (!container) return;
        const groupCards = container.querySelectorAll('.group-card');
        groupCards.forEach(card => {
            const shouldShow = !instanceId || card.dataset.instanceId === instanceId;
            card.style.display = shouldShow ? 'block' : 'none';
        });
    }

    sortGroups(sortBy) {
        const container = document.getElementById('groupsList');
        if (!container) return;
        console.log('Ordenar grupos por:', sortBy);
    }

    showNewContactModal() {
        this.updateGroupFilters();

        const modal = document.getElementById('newContactModal');
        if (modal) {
            modal.style.display = 'block';
            document.getElementById('newContactForm').reset();
        }
    }

    async saveNewContact(event) {
        event.preventDefault();

        try {
            const formData = {
                name: document.getElementById('newContactName').value,
                phone: document.getElementById('newContactPhone').value,
                email: document.getElementById('newContactEmail').value || undefined,
                notes: document.getElementById('newContactNotes').value || undefined
            };

            // ✅ USANDO APIREQUEST
            const data = await this.apiRequest('/api/participants/manual', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (data.success) {
                document.getElementById('newContactModal').style.display = 'none';
                this.auth.showNotification('Contato salvo com sucesso', 'success');
                // Recarregar a lista para incluir o novo contato
                await this.loadContacts();
            } else {
                throw new Error(data.error || 'Erro ao salvar contato');
            }

        } catch (error) {
            console.error('❌ Erro ao salvar contato:', error);
        }
    }

    updateContactsStats(statistics = null) {
        if (statistics) {
            document.getElementById('totalContacts').textContent = statistics.totalContacts || this.contacts.length;
            document.getElementById('totalGroups').textContent = this.groups.length;
            document.getElementById('connectedInstances').textContent = statistics.connectedInstances || this.instances.filter(i => i.status === 'connected').length;
        } else {
            document.getElementById('totalContacts').textContent = this.contacts.length;
            document.getElementById('totalGroups').textContent = this.groups.length;
            document.getElementById('connectedInstances').textContent = this.instances.filter(i => i.status === 'connected').length;
        }
    }

    updateUserProfile() {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');

        document.getElementById('userName').textContent = userData.name || 'Usuário';
        document.getElementById('profileName').textContent = userData.name || 'Nome do Usuário';
        document.getElementById('profileEmail').textContent = userData.email || 'email@exemplo.com';

        document.getElementById('userNameInput').value = userData.name || '';
        document.getElementById('userEmailInput').value = userData.email || '';
    }

    sendMessage(phone) {
        const digits = (phone || '').replace(/\D/g, '');
        if (!digits) {
            this.auth.showNotification('Telefone inválido', 'error');
            return;
        }
        const instance = this.instances.find(i => i.status === 'connected');
        if (!instance) {
            this.auth.showNotification('Nenhuma instância WhatsApp conectada', 'warning');
            return;
        }
        const jid = `${digits}@s.whatsapp.net`;
        this.openChatModal({ phone: digits, jid, instanceId: instance._id, sessionName: instance.sessionName });
    }

    openChatModal({ phone, jid, instanceId, sessionName }) {
        const existing = document.getElementById('chatModal');
        if (existing) existing.remove();
        const modalHtml = `
            <div id=\"chatModal\" class=\"modal\">
                <div class=\"modal-content chat-modal\">
                    <span class=\"close\">&times;</span>
                    <div class=\"chat-header\">
                        <h3>Chat com ${this.formatPhone(phone)}</h3>
                    </div>
                    <div id=\"chatMessagesList\" class=\"chat-messages\"></div>
                    <div class=\"chat-input\">
                        <textarea id=\"chatInputText\" placeholder=\"Digite sua mensagem...\" rows=\"3\"></textarea>
                        <button id=\"chatSendBtn\" class=\"btn btn-primary\"><i class=\"fas fa-paper-plane\"></i> Enviar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('chatModal');
        modal.style.display = 'block';
        modal.querySelector('.close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.getElementById('chatSendBtn').addEventListener('click', async () => {
            const text = document.getElementById('chatInputText').value.trim();
            if (!text) return;
            await this.sendChatMessage({ text, jid, instanceId, sessionName });
        });
        this.renderChatMessages([]);
        this.startChatPolling({ jid, instanceId, sessionName });
    }

    renderChatMessages(messages) {
        const list = document.getElementById('chatMessagesList');
        if (!list) return;

        if (!messages || messages.length === 0) {
            list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <p>Nenhuma mensagem ainda</p>
            </div>
        `;
            return;
        }

        list.innerHTML = messages.map(m => `
        <div class="chat-message ${m.direction === 'outgoing' ? 'out' : 'in'}">
            <div class="message-bubble">
                ${this.escapeHtml(m.message || '')}
                <div class="message-meta">
                    ${new Date(m.timestamp || Date.now()).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        })}
                </div>
            </div>
        </div>
    `).join('');

        list.scrollTop = list.scrollHeight;
    }

    appendMessageToChat(message) {
        const list = document.getElementById('chatMessagesList');
        if (!list) return;
        const html = `
            <div class=\"chat-message ${message.direction === 'outgoing' ? 'out' : 'in'}\">
                <div class=\"bubble\">${this.escapeHtml(message.message || '')}</div>
                <div class=\"meta\">${new Date(message.timestamp || Date.now()).toLocaleString('pt-BR')}</div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
        list.scrollTop = list.scrollHeight;
    }

    async sendChatMessage({ text, jid, instanceId, sessionName }) {
        try {
            this.appendMessageToChat({ message: text, direction: 'outgoing', timestamp: Date.now() });
            this.auth.showNotification('Enviando mensagem...', 'info');
            const payload = { jid, message: text, instanceId, sessionName };
            await this.apiRequest('/api/messages/send', { method: 'POST', body: JSON.stringify(payload) });
            this.auth.showNotification('Mensagem enviada', 'success');
            document.getElementById('chatInputText').value = '';
        } catch (error) {
            this.auth.showNotification(error.message || 'Erro ao enviar', 'error');
        }
    }

    startChatPolling({ jid, instanceId, sessionName }) {
        const poll = async () => {
            try {
                const params = new URLSearchParams({ jid, instanceId, sessionName, limit: '50' });
                const data = await this.apiRequest(`/api/messages/history?${params.toString()}`);
                if (data && data.success && Array.isArray(data.messages)) {
                    this.renderChatMessages(data.messages);
                }
            } catch { }
        };
        poll();
    }

    viewContactDetails(contactId) {
        console.log('Ver detalhes do contato:', contactId);
        this.auth.showNotification('Funcionalidade em desenvolvimento', 'info');
    }

    viewGroupDetails(groupId) {
        console.log('Ver detalhes do grupo:', groupId);
        this.auth.showNotification('Funcionalidade em desenvolvimento', 'info');
    }

    sendGroupMessage(groupId) {
        console.log('Enviar mensagem para grupo:', groupId);
        this.auth.showNotification('Funcionalidade em desenvolvimento', 'info');
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = 'login.html';
    }

    // Utilitários
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatPhone(phone) {
        // Formatação básica de telefone
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 13) { // +55 (11) 99999-9999
            return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
        } else if (cleaned.length === 12) { // 55 (11) 99999-9999
            return `${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
        } else if (cleaned.length === 11) { // (11) 99999-9999
            return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
        }
        return phone;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Inicialização global
window.AgendaManager = AgendaManager;


