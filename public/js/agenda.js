// ===== AGENDA MANAGER CLASS - VERSÃO COMPLETA ATUALIZADA =====
class AgendaManager {
    constructor(authManager = null) {
        this.auth = authManager;
        this.contacts = [];
        this.groups = [];
        this.whatsappInstances = [];

        this.state = {
            currentSection: 'contactsSection',
            filters: {
                search: '',
                group: '',
                sort: 'name',
                hasProfilePicture: false,
                isBusiness: false,
                verified: false
            },
            cache: {
                contacts: null,
                groups: null,
                instances: null,
                lastUpdated: null
            }
        };
    }

    init() {
        console.log('📍 Inicializando AgendaManager...');

        if (!this.isAuthenticated()) {
            console.error('❌ Usuário não autenticado');
            this.showNotification('Faça login para acessar a agenda', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return false;
        }

        this.setupEventListeners();
        this.setupNavigation();
        this.loadInitialData();

        console.log('✅ AgendaManager inicializado com sucesso');
        return true;
    }

    setupNavigation() {
        console.log('🧭 Configurando navegação...');

        const activeSection = document.querySelector('.content-section.active');
        if (!activeSection) {
            this.showSection('contactsSection');
        }

        this.updateUserInfo();
    }

    isAuthenticated() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            console.log('🔐 Token ou usuário não encontrado no localStorage');
            return false;
        }

        try {
            const userData = JSON.parse(user);
            console.log('👤 Usuário autenticado:', userData.name);
            return true;
        } catch (e) {
            console.error('Erro ao parsear dados do usuário:', e);
            return false;
        }
    }

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
            this.showLoading();

            const response = await fetch(endpoint, mergedOptions);

            if (response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
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
                this.showNotification('Erro de conexão com o servidor', 'error');
            } else if (error.message.includes('401')) {
                this.showNotification('Sessão expirada. Faça login novamente.', 'error');
            } else {
                this.showNotification(error.message, 'error');
            }

            throw error;
        } finally {
            this.hideLoading();
        }
    }

    setupEventListeners() {
        console.log('📍 Configurando event listeners da agenda...');

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Navegação
        document.addEventListener('click', (e) => {
            const navBtn = e.target.closest('.nav-btn');
            if (navBtn && navBtn.dataset.section) {
                this.showSection(navBtn.dataset.section);
            }
        });

        // Busca e filtros
        const searchInput = document.getElementById('searchContacts');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.filters.search = e.target.value;
                this.filterContacts();
            });
        }

        const filterGroup = document.getElementById('filterGroup');
        if (filterGroup) {
            filterGroup.addEventListener('change', (e) => {
                this.state.filters.group = e.target.value;
                this.filterContacts();
            });
        }

        const sortContacts = document.getElementById('sortContacts');
        if (sortContacts) {
            sortContacts.addEventListener('change', (e) => {
                this.state.filters.sort = e.target.value;
                this.sortContacts();
            });
        }

        // ✅ NOVOS FILTROS
        const filterProfilePicture = document.getElementById('filterProfilePicture');
        if (filterProfilePicture) {
            filterProfilePicture.addEventListener('change', (e) => {
                this.state.filters.hasProfilePicture = e.target.checked;
                this.filterContacts();
            });
        }

        const filterBusiness = document.getElementById('filterBusiness');
        if (filterBusiness) {
            filterBusiness.addEventListener('change', (e) => {
                this.state.filters.isBusiness = e.target.checked;
                this.filterContacts();
            });
        }

        const filterVerified = document.getElementById('filterVerified');
        if (filterVerified) {
            filterVerified.addEventListener('change', (e) => {
                this.state.filters.verified = e.target.checked;
                this.filterContacts();
            });
        }

        // Botões de ação
        const loadWhatsAppContactsBtn = document.getElementById('loadWhatsAppContacts');
        if (loadWhatsAppContactsBtn) {
            loadWhatsAppContactsBtn.addEventListener('click', () => {
                this.showWhatsAppInstancesModal();
            });
        }

        const showStatsBtn = document.getElementById('showStatsBtn');
        if (showStatsBtn) {
            showStatsBtn.addEventListener('click', () => {
                this.showContactsStatistics();
            });
        }

        this.updateUserInfo();
        this.setupModalEvents();
    }

    updateUserInfo() {
        try {
            const userData = JSON.parse(localStorage.getItem('user'));
            if (userData) {
                const userNameElement = document.getElementById('userName');
                const profileNameElement = document.getElementById('profileName');
                const profileEmailElement = document.getElementById('profileEmail');
                const userNameInput = document.getElementById('userNameInput');
                const userEmailInput = document.getElementById('userEmailInput');

                if (userNameElement) userNameElement.textContent = userData.name;
                if (profileNameElement) profileNameElement.textContent = userData.name;
                if (profileEmailElement) profileEmailElement.textContent = userData.email;
                if (userNameInput) userNameInput.value = userData.name;
                if (userEmailInput) userEmailInput.value = userData.email;

                console.log('📋 Informações do usuário atualizadas:', userData.name);
            }
        } catch (error) {
            console.error('Erro ao atualizar informações do usuário:', error);
        }
    }

    setupModalEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') ||
                e.target.classList.contains('modal-cancel') ||
                (e.target.classList.contains('modal') && !e.target.closest('.modal-content'))) {
                this.closeModals();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadContacts(),
                this.loadGroups(),
                this.loadWhatsAppInstances()
            ]);
            this.updateStats();
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
        }
    }

    async loadContacts() {
        try {
            console.log('📞 Carregando contatos...');
            const response = await this.apiRequest('/api/contact-groups?limit=1000');

            window.lastApiResponse = response;
            console.log('📦 Resposta bruta da API:', response);

            if (response.success) {
                this.contacts = this.extractContactsFromGroups(response.contactGroups || []);
                this.state.cache.contacts = this.contacts;
                this.state.cache.lastUpdated = Date.now();

                this.renderContacts();
                this.renderGroupFilters();
                this.renderAdvancedFilters();

                console.log(`✅ ${this.contacts.length} contatos carregados`);
                this.debugContactData();

                this.showNotification(`${this.contacts.length} contatos carregados`, 'success');
            } else {
                throw new Error(response.error || 'Erro ao carregar contatos');
            }
        } catch (error) {
            console.error('Erro ao carregar contatos:', error);
            this.renderContacts([]);
        }
    }

    extractContactsFromGroups(groups) {
        return this.extractAndCleanContactsFromGroups(groups);
    }

    async loadGroups() {
        try {
            console.log('👥 Carregando grupos...');
            const response = await this.apiRequest('/api/contact-groups?limit=1000');

            if (response.success) {
                this.groups = response.contactGroups || [];
                this.state.cache.groups = this.groups;

                this.renderGroups();
                this.renderGroupFilters();

                console.log(`✅ ${this.groups.length} grupos carregados`);
            } else {
                throw new Error(response.error || 'Erro ao carregar grupos');
            }
        } catch (error) {
            console.error('Erro ao carregar grupos:', error);
            this.renderGroups([]);
        }
    }

    async loadWhatsAppInstances() {
        try {
            console.log('📱 Carregando instâncias WhatsApp...');
            const response = await this.apiRequest('/api/whatsapp/instances');

            if (response.success) {
                this.whatsappInstances = response.instances || [];
                this.state.cache.instances = this.whatsappInstances;

                console.log(`✅ ${this.whatsappInstances.length} instâncias carregadas`);
                return this.whatsappInstances;
            } else {
                throw new Error(response.error || 'Erro ao carregar instâncias');
            }
        } catch (error) {
            console.error('Erro ao carregar instâncias:', error);
            return [];
        }
    }

    // ✅ NOVO: Carregar contatos com detalhes do WhatsApp
    async loadWhatsAppContactsWithDetails(instanceId) {
        try {
            console.log(`📞 Carregando contatos com detalhes da instância: ${instanceId}`);

            const response = await this.apiRequest(`/api/whatsapp/instances/${instanceId}/load-contacts`);

            if (response.success) {
                this.showNotification(
                    `${response.contactCount} contatos carregados com informações completas`,
                    'success'
                );

                await this.loadContacts();
                return response;
            } else {
                throw new Error(response.error || 'Erro ao carregar contatos com detalhes');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar contatos com detalhes:', error);
            this.showNotification(error.message, 'error');
            throw error;
        }
    }

    // ✅ NOVO: Atualizar informações de um contato específico
    async refreshContactInfo(instanceId, contactId) {
        try {
            alert('Atualizando informações do contato...');
            console.log(`🔄 Atualizando informações do contato: ${contactId}`);

            const response = await this.apiRequest(
                `/api/whatsapp/instances/${instanceId}/refresh-contact`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ contactId })
                }
            );

            if (response.success) {
                this.showNotification('Informações do contato atualizadas', 'success');
                await this.loadContacts();
                return response.contact;
            } else {
                throw new Error(response.error || 'Erro ao atualizar contato');
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar contato:', error);
            this.showNotification(error.message, 'error');
            throw error;
        }
    }

    // ✅ NOVO: Buscar estatísticas dos contatos
    async getContactsStatistics(instanceId = null) {
        try {
            let endpoint = '/api/contact-groups/statistics/overview';
            if (instanceId) {
                endpoint = `/api/whatsapp/instances/${instanceId}/contacts/stats`;
            }

            const response = await this.apiRequest(endpoint);

            if (response.success) {
                return instanceId ? response.statistics : response;
            } else {
                throw new Error(response.error || 'Erro ao buscar estatísticas');
            }
        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas:', error);
            throw error;
        }
    }

    updateStats() {
        const totalContacts = document.getElementById('totalContacts');
        const totalGroups = document.getElementById('totalGroups');
        const connectedInstances = document.getElementById('connectedInstances');

        if (totalContacts) totalContacts.textContent = this.contacts.length;
        if (totalGroups) totalGroups.textContent = this.groups.length;
        if (connectedInstances) {
            this.getConnectedInstancesCount().then(count => {
                connectedInstances.textContent = count;
            }).catch(() => {
                connectedInstances.textContent = '0';
            });
        }
    }

    async getConnectedInstancesCount() {
        try {
            const instances = await this.loadWhatsAppInstances();
            const connected = instances.filter(inst => inst.status === 'connected').length;
            console.log(`📱 ${connected} instâncias conectadas`);
            return connected;
        } catch (error) {
            console.error('Erro ao obter instâncias:', error);
            return 0;
        }
    }

    // RENDERIZAÇÃO ATUALIZADA
    renderContacts(contactsToRender = null) {
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) {
            console.warn('❌ Elemento contactsList não encontrado');
            return;
        }

        const contacts = contactsToRender || this.contacts;

        if (contacts.length === 0) {
            contactsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-address-book"></i>
                <h3>Nenhum contato encontrado</h3>
                <p>Adicione contatos através dos grupos ou importe do WhatsApp</p>
                <button class="btn btn-primary" onclick="agendaManager.showWhatsAppInstancesModal()">
                    <i class="fab fa-whatsapp"></i>
                    Importar do WhatsApp
                </button>
            </div>
        `;
            return;
        }

        contactsList.innerHTML = contacts.map(contact => `
        <div class="contact-card" data-contact-id="${contact._id}">
            <div class="contact-header">
                <div class="contact-avatar">
                    ${contact.profilePicture ?
                `<img src="${contact.profilePicture}" alt="${contact.name}" onerror="this.style.display='none'">` :
                contact.photo ?
                    `<img src="${contact.photo}" alt="${contact.name}" onerror="this.style.display='none'">` :
                    `<div class="avatar-placeholder">${contact.name.charAt(0).toUpperCase()}</div>`
            }
                    ${contact.verified ? `<div class="verified-badge" title="Verificado"><i class="fas fa-check-circle"></i></div>` : ''}
                </div>
                <div class="contact-info">
                    <h3>${this.escapeHtml(contact.name)}</h3>
                    <div class="contact-phone">${this.formatPhone(contact.phone)}</div>
                    ${contact.pushName && contact.pushName !== contact.name ?
                `<div class="contact-pushname">@${this.escapeHtml(contact.pushName)}</div>` : ''}
                    ${contact.whatsappId ? `<div class="contact-waid">${contact.whatsappId}</div>` : ''}
                    
                    <!-- NOVAS INFORMAÇÕES -->
                    <div class="contact-meta">
                        ${contact.isBusiness ? `<span class="business-badge" title="Conta Business"><i class="fas fa-briefcase"></i> Business</span>` : ''}
                        ${contact.status ? `<span class="status-text">"${this.escapeHtml(contact.status)}"</span>` : ''}
                        ${contact.lastSeen ? `<span class="last-seen">Visto: ${this.formatRelativeTime(contact.lastSeen)}</span>` : ''}
                    </div>
                </div>
            </div>
            
            ${contact.groups && contact.groups.length > 0 ? `
                <div class="contact-groups">
                    ${contact.groups.slice(0, 3).map(group => `
                        <span class="group-tag">${this.escapeHtml(group)}</span>
                    `).join('')}
                    ${contact.groups.length > 3 ? `<span class="group-tag">+${contact.groups.length - 3}</span>` : ''}
                </div>
            ` : ''}
            
            
            
            <div class="contact-actions">
                <button class="btn-icon" onclick="agendaManager.viewContact('${contact._id}')" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                ${contact.platform === 'whatsapp' ? `
                <button class="btn-icon" onclick="agendaManager.refreshContactInfoFromModal('${contact._id}')" title="Atualizar informações">
                    <i class="fas fa-sync-alt"></i>
                </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    }

    renderGroups() {
        const groupsList = document.getElementById('groupsList');
        if (!groupsList) {
            console.warn('❌ Elemento groupsList não encontrado');
            return;
        }

        if (this.groups.length === 0) {
            groupsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-layer-group"></i>
                <h3>Nenhum grupo encontrado</h3>
                <p>Crie seu primeiro grupo para organizar os contatos</p>
            </div>
        `;
            return;
        }

        groupsList.innerHTML = this.groups.map((group, index) => `
        <div class="group-card">
            <div class="group-header">
                <div>
                    <h3>${this.escapeHtml(group.name)}</h3>
                    ${group.description ? `
                        <button class="accordion-btn" onclick="toggleAccordion(${index})">
                            <i class="fas fa-chevron-down"></i> Descrição
                        </button>
                        <div id="accordion-${index}" class="accordion-content">
                            <p>${this.escapeHtml(group.description)}</p>
                        </div>
                    ` : ''}
                </div>
                <span class="group-count">${group.contactCount || 0} contatos</span>
            </div>
            
            <div class="group-stats">
                <small>Criado em ${this.formatDate(group.createdAt)}</small>
                <small>Fonte: ${group.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}</small>
                ${group.whatsappInstanceId ? `<small>Instância: ${this.getWhatsAppInstanceName(group.whatsappInstanceId)}</small>` : ''}
            </div>
            
            <div class="group-actions">
                <button class="btn btn-secondary" onclick="agendaManager.viewGroupContacts('${group._id}')">
                    <i class="fas fa-eye"></i>
                    Ver Contatos
                </button>
            </div>
        </div>
    `).join('');

        // Adiciona a função global para controle do acordeon
        window.toggleAccordion = (index) => {
            const content = document.getElementById(`accordion-${index}`);
            const btn = content.previousElementSibling;
            if (content.classList.contains('open')) {
                content.classList.remove('open');
                btn.innerHTML = '<i class="fas fa-chevron-down"></i> Descrição';
            } else {
                content.classList.add('open');
                btn.innerHTML = '<i class="fas fa-chevron-up"></i> Ocultar';
            }
        };
    }


    renderGroupFilters() {
        const filterGroup = document.getElementById('filterGroup');
        if (!filterGroup) return;

        const groupsOptions = this.groups.map(group =>
            `<option value="${group._id}">${this.escapeHtml(group.name)} (${group.contactCount || 0})</option>`
        ).join('');

        filterGroup.innerHTML = '<option value="">Todos os Grupos</option>' + groupsOptions;
    }

    // ✅ NOVO: Renderizar filtros avançados
    renderAdvancedFilters() {
        const advancedFilters = document.getElementById('advancedFilters');
        if (!advancedFilters) return;

        advancedFilters.innerHTML = `
            <div class="filter-group">
                <label>
                    <input type="checkbox" id="filterProfilePicture"> 
                    Com foto de perfil
                </label>
                <label>
                    <input type="checkbox" id="filterBusiness">
                    Contas Business
                </label>
                <label>
                    <input type="checkbox" id="filterVerified">
                    Verificados
                </label>
            </div>
        `;

        // Reconfigurar event listeners
        this.setupEventListeners();
    }

    viewContact(contactId) {
        const contact = this.contacts.find(c => c._id === contactId);
        if (contact) {
            this.showContactDetails(contact);
        }
    }

    // ✅ ATUALIZADO: Modal de detalhes do contato com novas informações
    showContactDetails(contact) {
        const modalHTML = `
            <div id="contactDetailsModal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <span class="close">&times;</span>
                    <div class="contact-details-header">
                        <div class="contact-avatar-large">
                            ${contact.profilePicture ?
                `<img src="${contact.profilePicture}" alt="${contact.name}">` :
                contact.photo ?
                    `<img src="${contact.photo}" alt="${contact.name}">` :
                    `<div class="avatar-large-placeholder">${contact.name.charAt(0).toUpperCase()}</div>`
            }
                            ${contact.verified ? `<div class="verified-badge-large"><i class="fas fa-check-circle"></i></div>` : ''}
                        </div>
                        <h3>${this.escapeHtml(contact.name)}</h3>
                        ${contact.pushName && contact.pushName !== contact.name ?
                `<p class="contact-pushname-large">@${this.escapeHtml(contact.pushName)}</p>` : ''}
                        ${contact.isBusiness ? `<div class="business-badge-large"><i class="fas fa-briefcase"></i> Conta Business</div>` : ''}
                    </div>
                    
                    <div class="contact-details-body">
                        <div class="detail-section">
                            <h4>Informações de Contato</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <strong>Telefone:</strong>
                                    <span>${this.formatPhone(contact.phone)}</span>
                                </div>
                                ${contact.whatsappId ? `
                                <div class="detail-item">
                                    <strong>WhatsApp ID:</strong>
                                    <span class="waid">${contact.whatsappId}</span>
                                </div>
                                ` : ''}
                                ${contact.platform ? `
                                <div class="detail-item">
                                    <strong>Plataforma:</strong>
                                    <span class="platform-badge ${contact.platform}">${contact.platform}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>

                        ${contact.status || contact.lastSeen ? `
                        <div class="detail-section">
                            <h4>Status WhatsApp</h4>
                            <div class="detail-grid">
                                ${contact.status ? `
                                <div class="detail-item">
                                    <strong>Status:</strong>
                                    <span>"${this.escapeHtml(contact.status)}"</span>
                                </div>
                                ` : ''}
                                ${contact.lastSeen ? `
                                <div class="detail-item">
                                    <strong>Última vez online:</strong>
                                    <span>${this.formatDate(contact.lastSeen)}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        ` : ''}

                        ${contact.businessName || contact.businessCategory ? `
                        <div class="detail-section">
                            <h4>Informações Business</h4>
                            <div class="detail-grid">
                                ${contact.businessName ? `
                                <div class="detail-item">
                                    <strong>Nome do negócio:</strong>
                                    <span>${this.escapeHtml(contact.businessName)}</span>
                                </div>
                                ` : ''}
                                ${contact.businessCategory ? `
                                <div class="detail-item">
                                    <strong>Categoria:</strong>
                                    <span>${this.escapeHtml(contact.businessCategory)}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        ` : ''}

                        <div class="detail-section">
                            <h4>Grupos</h4>
                            <div class="groups-tags">
                                ${contact.groups && contact.groups.length > 0 ?
                contact.groups.map(group => `<span class="group-tag">${this.escapeHtml(group)}</span>`).join('') :
                '<span class="no-groups">Nenhum grupo</span>'
            }
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        ${contact.platform === 'whatsapp' ? `
                        <button class="btn btn-secondary" onclick="agendaManager.refreshContactInfoFromModal('${contact._id}')">
                            <i class="fas fa-sync-alt"></i>
                            Atualizar Informações
                        </button>
                        ` : ''}
                        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Fechar</button>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('contactDetailsModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('contactDetailsModal');

        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => modal.remove());

        modal.style.display = 'block';
    }

    // ✅ NOVO: Modal para selecionar instância WhatsApp
    async showWhatsAppInstancesModal() {
        await this.loadWhatsAppInstances();

        const connectedInstances = this.whatsappInstances.filter(inst => inst.status === 'connected');

        if (connectedInstances.length === 0) {
            this.showNotification('Nenhuma instância WhatsApp conectada', 'warning');
            return;
        }

        const modalHTML = `
            <div id="whatsappInstancesModal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <span class="close">&times;</span>
                    <h3>Importar Contatos do WhatsApp</h3>
                    <p>Selecione uma instância conectada para importar contatos com informações completas:</p>
                    
                    <div class="instances-list">
                        ${connectedInstances.map(instance => `
                            <div class="instance-card">
                                <div class="instance-info">
                                    <h4>${this.escapeHtml(instance.sessionName)}</h4>
                                    <div class="instance-details">
                                        <span class="phone-number">${instance.phoneNumber || 'Número não identificado'}</span>
                                        <span class="instance-status connected">Conectado</span>
                                    </div>
                                </div>
                                <button class="btn btn-primary" onclick="agendaManager.loadWhatsAppContactsWithDetails('${instance._id}')">
                                    <i class="fas fa-download"></i>
                                    Importar Contatos
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('whatsappInstancesModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('whatsappInstancesModal');

        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => modal.remove());

        modal.style.display = 'block';
    }

    // ✅ NOVO: Modal de estatísticas
    async showContactsStatistics() {
        try {
            const stats = await this.getContactsStatistics();

            const modalHTML = `
                <div id="contactsStatsModal" class="modal">
                    <div class="modal-content" style="max-width: 600px;">
                        <span class="close">&times;</span>
                        <h3>Estatísticas dos Contatos</h3>
                        
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-number">${stats.totalContacts || this.contacts.length}</div>
                                <div class="stat-label">Total de Contatos</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">${stats.withProfilePicture || this.contacts.filter(c => c.profilePicture || c.photo).length}</div>
                                <div class="stat-label">Com Foto</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">${stats.businessAccounts || this.contacts.filter(c => c.isBusiness).length}</div>
                                <div class="stat-label">Contas Business</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">${stats.verifiedAccounts || this.contacts.filter(c => c.verified).length}</div>
                                <div class="stat-label">Verificados</div>
                            </div>
                        </div>

                        ${stats.byPlatform ? `
                        <div class="stats-section">
                            <h4>Distribuição por Plataforma</h4>
                            <div class="platform-stats">
                                ${Object.entries(stats.byPlatform).map(([platform, count]) => `
                                    <div class="platform-stat">
                                        <span class="platform-name">${platform}</span>
                                        <span class="platform-count">${count}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="modal-footer">
                            <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Fechar</button>
                        </div>
                    </div>
                </div>
            `;

            const existingModal = document.getElementById('contactsStatsModal');
            if (existingModal) existingModal.remove();

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = document.getElementById('contactsStatsModal');

            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => modal.remove());

            modal.style.display = 'block';

        } catch (error) {
            this.showNotification('Erro ao carregar estatísticas', 'error');
        }
    }

    // ✅ NOVO: Atualizar contato a partir do modal
    async refreshContactInfoFromModal(contactId) {
        const contact = this.contacts.find(c => c._id === contactId);
        if (!contact) return;

        // Buscar instâncias conectadas
        await this.loadWhatsAppInstances();
        const connectedInstances = this.whatsappInstances.filter(inst => inst.status === 'connected');

        if (connectedInstances.length === 0) {
            this.showNotification('Nenhuma instância conectada para atualizar', 'warning');
            return;
        }

        // Usar a primeira instância conectada
        const instance = connectedInstances[0];

        try {
            await this.refreshContactInfo(instance._id, contactId);
            this.closeModals();
        } catch (error) {
            // Erro já tratado no método refreshContactInfo
        }
    }

    async viewGroupContacts(groupId) {
        try {
            const response = await this.apiRequest(`/api/contact-groups/${groupId}`);
            if (response.success) {
                this.showGroupContactsModal(response.contactGroup);
            } else {
                throw new Error(response.error || 'Erro ao carregar grupo');
            }
        } catch (error) {
            console.error('Erro ao carregar grupo:', error);
        }
    }

    showGroupContactsModal(group) {
        const modalHTML = `
            <div id="groupContactsModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <span class="close">&times;</span>
                    <h3>Contatos do Grupo: ${this.escapeHtml(group.name)}</h3>
                    <div class="contacts-list-modal">
                        ${group.contacts && group.contacts.length > 0 ?
                group.contacts.map(contact => `
                                <div class="contact-item-modal">
                                    <div class="contact-avatar-small">
                                        ${contact.profilePicture ?
                        `<img src="${contact.profilePicture}" alt="${contact.name}">` :
                        contact.photo ?
                            `<img src="${contact.photo}" alt="${contact.name}">` :
                            contact.name.charAt(0).toUpperCase()
                    }
                                    </div>
                                    <div class="contact-info-modal">
                                        <strong>${this.escapeHtml(contact.name)}</strong>
                                        <span>${this.formatPhone(contact.phone)}</span>
                                        ${contact.isBusiness ? `<small class="business-indicator">Business</small>` : ''}
                                    </div>
                                </div>
                            `).join('') :
                '<p class="no-contacts">Nenhum contato neste grupo</p>'
            }
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Fechar</button>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('groupContactsModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('groupContactsModal');

        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => modal.remove());

        modal.style.display = 'block';
    }

    // FILTROS ATUALIZADOS
    filterContacts() {
        let filteredContacts = this.contacts;

        if (this.state.filters.search) {
            const searchTerm = this.state.filters.search.toLowerCase();
            filteredContacts = filteredContacts.filter(contact =>
                contact.name.toLowerCase().includes(searchTerm) ||
                contact.phone.includes(searchTerm) ||
                (contact.pushName && contact.pushName.toLowerCase().includes(searchTerm)) ||
                (contact.whatsappId && contact.whatsappId.includes(searchTerm))
            );
        }

        if (this.state.filters.group) {
            filteredContacts = filteredContacts.filter(contact =>
                contact.groupIds && contact.groupIds.includes(this.state.filters.group)
            );
        }

        // ✅ NOVOS FILTROS
        if (this.state.filters.hasProfilePicture) {
            filteredContacts = filteredContacts.filter(contact =>
                contact.profilePicture || contact.photo
            );
        }

        if (this.state.filters.isBusiness) {
            filteredContacts = filteredContacts.filter(contact => contact.isBusiness);
        }

        if (this.state.filters.verified) {
            filteredContacts = filteredContacts.filter(contact => contact.verified);
        }

        this.sortContacts(filteredContacts);
    }

    sortContacts(contactsToSort = null) {
        const contacts = contactsToSort || this.contacts;
        const sortedContacts = [...contacts];

        switch (this.state.filters.sort) {
            case 'name':
                sortedContacts.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'recent':
                sortedContacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'business':
                sortedContacts.sort((a, b) => (b.isBusiness === a.isBusiness) ? 0 : b.isBusiness ? 1 : -1);
                break;
        }

        this.renderContacts(sortedContacts);
    }

    // MÉTODOS DE PROCESSAMENTO DE DADOS (mantidos da versão anterior)
    extractAndCleanContactsFromGroups(groups) {
        const contactsMap = new Map();

        groups.forEach(group => {
            if (group.contacts && Array.isArray(group.contacts)) {
                group.contacts.forEach(contact => {
                    const contactId = contact._id || `${contact.phone}-${contact.name}`;

                    if (!contactsMap.has(contactId)) {
                        const cleanedContact = this.cleanContactData(contact, group);

                        contactsMap.set(contactId, {
                            _id: contactId,
                            name: cleanedContact.name,
                            phone: cleanedContact.phone,
                            whatsappId: cleanedContact.whatsappId,
                            photo: cleanedContact.photo,

                            // ✅ NOVOS CAMPOS
                            pushName: cleanedContact.pushName,
                            shortName: cleanedContact.shortName,
                            profilePicture: cleanedContact.profilePicture,
                            status: cleanedContact.status,
                            lastSeen: cleanedContact.lastSeen,
                            isBusiness: cleanedContact.isBusiness,
                            businessName: cleanedContact.businessName,
                            businessCategory: cleanedContact.businessCategory,
                            verified: cleanedContact.verified,
                            platform: cleanedContact.platform,

                            groups: [group.name],
                            groupIds: [group._id],
                            createdAt: contact.createdAt || group.createdAt,

                            originalData: {
                                name: contact.name,
                                phone: contact.phone,
                                whatsappId: contact.whatsappId,
                                rawData: contact
                            }
                        });
                    } else {
                        const existingContact = contactsMap.get(contactId);
                        if (!existingContact.groups.includes(group.name)) {
                            existingContact.groups.push(group.name);
                            existingContact.groupIds.push(group._id);
                        }
                    }
                });
            }
        });

        return Array.from(contactsMap.values());
    }

   cleanContactData(contact, group) {
    let { name, phone, whatsappId } = contact;
    
    // PRIORIDADE para nomes reais do WhatsApp
    if (this.isDefaultName(name) && contact.pushName) {
        name = contact.pushName; // Usar pushName do WhatsApp
    } 
    else if (this.isDefaultName(name) && contact.shortName) {
        name = contact.shortName; // Ou shortName
    }
    else if (this.isDefaultName(name)) {
        name = this.generateBetterName(phone, whatsappId, group.name);
    }
    
    // Correção de telefone para Brasil
    phone = this.formatPhoneForBrazil(phone);
    
    return { name, phone, whatsappId, /* outros campos */ };
}


    // NOVO: Corrigir WhatsApp ID
    fixWhatsAppId(whatsappId, phone) {
        if (!whatsappId) return null;

        // Converter @lid para @c.us
        if (whatsappId.includes('@lid')) {
            return whatsappId.replace('@lid', '@c.us');
        }

        // Se não tem @, adicionar @c.us
        if (!whatsappId.includes('@')) {
            return `${whatsappId}@c.us`;
        }

        return whatsappId;
    }

    // NOVO: Extrair phone brasileiro do WhatsApp ID
    extractBrazilianPhone(whatsappId, originalPhone) {
        // Priorizar extração do WhatsApp ID
        if (whatsappId && whatsappId.includes('@')) {
            const numberPart = whatsappId.split('@')[0];

            // Se começa com 55 (Brasil)
            if (numberPart.startsWith('55')) {
                const ddd = numberPart.slice(2, 4);
                const number = numberPart.slice(4);

                if (number.length === 9) {
                    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
                } else if (number.length === 8) {
                    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
                }
            }
        }

        // Fallback para formatação genérica
        return this.formatPhoneForBrazil(originalPhone);
    }

    isDefaultName(name) {
        if (!name || name.trim() === '' || name.length < 2) return true;

        const defaultPatterns = [
            /^user-/i,
            /^\d+$/,
            /^user\d+$/i,
            /^contacto?\d*$/i,
            /^unknown/i,
            /^sem nome/i,
            /^null$/i,
            /^undefined$/i,
            /^[\d\s\-_]+$/ // Apenas números, hífens, underlines
        ];

        return defaultPatterns.some(pattern => pattern.test(name));
    }

   
formatPhoneForBrazil(phone) {
    if (!phone) return 'N/A';
    
    let clean = phone.replace(/\D/g, '');
    
    // Padrão Brasil: +55 (11) 99999-9999
    if (clean.startsWith('55')) {
        clean = clean.slice(2); // Remove o 55
    }
    
    // Se tem 11 dígitos (DDD + 9 dígitos)
    if (clean.length === 11) {
        return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    // Se tem 10 dígitos (DDD + 8 dígitos)
    else if (clean.length === 10) {
        return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    
    return clean; // Retorna limpo se não conhece o formato
}


    debugContactTransformation() {
        console.group('🔄 TRANSFORMAÇÃO DE CONTATOS');
        this.contacts.slice(0, 5).forEach((contact, index) => {
            console.log(`📞 Contato ${index}:`, {
                'ANTES': {
                    name: contact.originalData?.name,
                    phone: contact.originalData?.phone,
                    whatsappId: contact.originalData?.whatsappId,
                    pushName: contact.originalData?.pushName
                },
                'DEPOIS': {
                    name: contact.name,
                    phone: contact.phone,
                    whatsappId: contact.whatsappId,
                    platform: contact.platform
                }
            });
        });
        console.groupEnd();
    }
    generateBetterName(phone, whatsappId, groupName) {
        if (whatsappId && whatsappId.includes('@')) {
            const numberPart = whatsappId.split('@')[0];
            if (numberPart.length >= 8) {
                return `Contato ${numberPart.slice(-8)}`;
            }
        }

        if (phone && phone.length >= 8) {
            const cleanPhone = phone.replace(/\D/g, '');
            return `Contato ${cleanPhone.slice(-8)}`;
        }

        if (groupName && groupName !== 'undefined') {
            return `Contato ${groupName.slice(0, 15)}`;
        }

        return 'Contato Sem Nome';
    }

    cleanPhoneNumber(phone) {
        if (!phone) return 'N/A';
        let clean = phone.replace(/\D/g, '');

        if (clean.startsWith('55')) clean = clean.slice(2);
        if (clean.startsWith('0')) clean = clean.slice(1);

        if (clean.length === 11) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
        }
        if (clean.length === 10) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
        }

        return clean;
    }

    cleanWhatsAppId(whatsappId, phone) {
        if (!whatsappId) {
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length >= 10) {
                return `${cleanPhone}@c.us`;
            }
            return null;
        }

        if (whatsappId.includes('@lid')) {
            return whatsappId.replace('@lid', '@c.us');
        }

        if (!whatsappId.includes('@')) {
            return `${whatsappId}@c.us`;
        }

        return whatsappId;
    }

    // MÉTODOS AUXILIARES
    getWhatsAppInstanceName(instanceId) {
        const instance = this.whatsappInstances.find(inst => inst._id === instanceId);
        return instance ? instance.sessionName : 'Desconhecida';
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'agora mesmo';
        if (diffMins < 60) return `há ${diffMins} min`;
        if (diffHours < 24) return `há ${diffHours} h`;
        if (diffDays === 1) return 'ontem';
        if (diffDays < 7) return `há ${diffDays} dias`;

        return this.formatDate(dateString);
    }

    debugContactData() {
        console.log('🔍 DEBUG - Estrutura dos dados de contato:');
        if (this.contacts.length > 0) {
            const sampleContact = this.contacts[0];
            console.log('📋 Contato exemplo:', sampleContact);
        }
    }

    // MÉTODOS DE NAVEGAÇÃO
    showSection(sectionId) {
        if (!this.isAuthenticated()) {
            this.showNotification('Faça login para acessar esta seção', 'error');
            return;
        }

        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

        const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            this.loadSectionData(sectionId);
        }

        this.state.currentSection = sectionId;
    }

    loadSectionData(sectionId) {
        switch (sectionId) {
            case 'contactsSection':
                this.loadContacts();
                break;
            case 'groupsSection':
                this.loadGroups();
                break;
            case 'profileSection':
                this.updateStats();
                break;
        }
    }

    logout() {
        if (confirm('Tem certeza que deseja sair?')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        }
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type}`;
            notification.style.display = 'block';

            setTimeout(() => {
                notification.style.display = 'none';
            }, 4000);
        }
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'flex';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }

    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
        return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('pt-BR');
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Inicialização global
window.AgendaManager = AgendaManager;