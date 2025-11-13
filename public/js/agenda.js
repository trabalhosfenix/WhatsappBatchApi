// 📁 js/agenda.js (ATUALIZADO COM APIREQUEST)
class AgendaManager {
    constructor(auth) {
        this.auth = auth;
        this.currentSection = 'contactsSection';
        this.contacts = [];
        this.groups = [];
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
                throw new Error(`HTTP error! status: ${response.status}`);
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
        await this.loadContactGroups();
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
            
            if (data.success) {
                this.contacts = data.participants || [];
                this.renderContacts();
                this.updateContactsStats(data.statistics);
                
                this.auth.showNotification(`${this.contacts.length} contatos carregados com sucesso`, 'success');
            } else {
                throw new Error(data.error || 'Erro ao carregar contatos');
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar contatos:', error);
            // O erro já foi tratado no apiRequest
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

        container.innerHTML = this.contacts.map(contact => `
            <div class="contact-card" data-contact-id="${contact.id}">
                <div class="contact-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="contact-info">
                    <h4 class="contact-name">${this.escapeHtml(contact.name)}</h4>
                    <p class="contact-phone">${this.formatPhone(contact.phone)}</p>
                    <p class="contact-waid">${contact.whatsappId}</p>
                    ${contact.messageCount > 1 ? `<span class="message-badge">${contact.messageCount} mensagens</span>` : ''}
                    ${contact.isActive ? `<span class="active-badge">Ativo</span>` : '<span class="inactive-badge">Inativo</span>'}
                    ${contact.lastActivity ? `<p class="contact-activity">Última atividade: ${this.formatDate(contact.lastActivity)}</p>` : ''}
                </div>
                <div class="contact-actions">
                    <button class="btn-icon" onclick="agendaManager.sendMessage('${contact.phone}')" title="Enviar mensagem">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="btn-icon" onclick="agendaManager.viewContactDetails('${contact.id}')" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `).join('');
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

    updateGroupFilters() {
        // Atualizar filtro de grupos nos contatos
        const groupFilter = document.getElementById('filterGroup');
        if (groupFilter) {
            groupFilter.innerHTML = '<option value="">Todos os Grupos</option>';
            this.groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group._id;
                option.textContent = group.name;
                groupFilter.appendChild(option);
            });
        }

        // Atualizar select de grupos no modal de novo contato
        const groupsSelect = document.getElementById('newContactGroups');
        if (groupsSelect) {
            groupsSelect.innerHTML = this.groups.map(group => 
                `<option value="${group._id}">${this.escapeHtml(group.name)}</option>`
            ).join('');
        }
    }

    filterContacts() {
        let filtered = [...this.contacts];

        // Filtro de busca
        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            filtered = filtered.filter(contact => 
                contact.name.toLowerCase().includes(searchTerm) ||
                contact.phone.includes(searchTerm) ||
                (contact.whatsappId && contact.whatsappId.toLowerCase().includes(searchTerm))
            );
        }

        // Filtro de plataforma
        if (this.filters.platform) {
            filtered = filtered.filter(contact => contact.source === this.filters.platform);
        }

        // Filtro de grupo (será implementado quando tiver grupos associados)
        if (this.filters.group) {
            // Implementar lógica de filtro por grupo quando disponível
        }

        this.sortContacts(filtered);
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

        container.innerHTML = contacts.map(contact => `
            <div class="contact-card" data-contact-id="${contact.id}">
                <div class="contact-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="contact-info">
                    <h4 class="contact-name">${this.escapeHtml(contact.name)}</h4>
                    <p class="contact-phone">${this.formatPhone(contact.phone)}</p>
                    <p class="contact-waid">${contact.whatsappId}</p>
                    ${contact.messageCount > 1 ? `<span class="message-badge">${contact.messageCount} mensagens</span>` : ''}
                    ${contact.isActive ? `<span class="active-badge">Ativo</span>` : '<span class="inactive-badge">Inativo</span>'}
                </div>
                <div class="contact-actions">
                    <button class="btn-icon" onclick="agendaManager.sendMessage('${contact.phone}')" title="Enviar mensagem">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="btn-icon" onclick="agendaManager.viewContactDetails('${contact.id}')" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `).join('');
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
            <div class="group-card">
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
            const shouldShow = groupName.includes(searchTerm.toLowerCase());
            card.style.display = shouldShow ? 'block' : 'none';
        });
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
                await this.loadContacts();
            } else {
                throw new Error(data.error || 'Erro ao salvar contato');
            }
            
        } catch (error) {
            console.error('❌ Erro ao salvar contato:', error);
            // O erro já foi tratado no apiRequest
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
        console.log('Enviar mensagem para:', phone);
        this.auth.showNotification(`Preparando para enviar mensagem para ${phone}`, 'info');
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