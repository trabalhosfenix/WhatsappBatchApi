// ===== AGENDA MANAGER CLASS =====
class AgendaManager {
    constructor(authManager = null) {
        this.auth = authManager;
        this.contacts = [];
        this.groups = [];

        this.state = {
            currentSection: 'contactsSection',
            filters: {
                search: '',
                group: '',
                sort: 'name'
            },
            cache: {
                contacts: null,
                groups: null,
                lastUpdated: null
            }
        };
    }

    init() {
        console.log('📍 Inicializando AgendaManager...');

        // Verificar autenticação via localStorage (igual ao app principal)
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
        this.setupNavigation();
        this.loadInitialData();

        console.log('✅ AgendaManager inicializado com sucesso');
        return true;
    }


    // ADICIONE ESTE MÉTODO QUE ESTÁ FALTANDO
    setupNavigation() {
        console.log('🧭 Configurando navegação...');

        // Verificar se já temos uma seção ativa
        const activeSection = document.querySelector('.content-section.active');
        if (!activeSection) {
            // Ativar a primeira seção por padrão
            this.showSection('contactsSection');
        }

        // Atualizar informações do usuário
        this.updateUserInfo();
    }

    // Verificação de autenticação usando localStorage (igual ao Auth do app.js)
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

    // Verificação de autenticação usando localStorage (igual ao Auth do app.js)
    isAuthenticated() {
        const token = localStorage.getItem('authToken'); // MUDOU PARA localStorage
        const user = localStorage.getItem('user'); // MUDOU PARA localStorage

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

    // Método seguro para requisições API
    async apiRequest(endpoint, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Usuário não autenticado');
        }

        const token = localStorage.getItem('authToken'); // MUDOU PARA localStorage
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
                // Token expirado
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

        // Atualizar informações do usuário
        this.updateUserInfo();

        // Modais
        this.setupModalEvents();
    }

    updateUserInfo() {
        try {
            const userData = JSON.parse(localStorage.getItem('user')); // MUDOU PARA localStorage
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
        // Fechar modais
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') ||
                e.target.classList.contains('modal-cancel') ||
                (e.target.classList.contains('modal') && e.target.id !== 'contactModal' && e.target.id !== 'groupModal')) {
                this.closeModals();
            }
        });

        // Tecla ESC para fechar modais
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
                this.loadGroups()
            ]);
            this.updateStats();
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
            // Não mostrar notificação aqui para evitar spam
        }
    }

    async loadContacts() {
        try {
            console.log('📞 Carregando contatos...');
            const response = await this.apiRequest('/api/contact-groups?limit=1000');

            // SALVAR RESPOSTA BRUTA PARA DEBUG
            window.lastApiResponse = response;
            console.log('📦 Resposta bruta da API:', response);

            if (response.success) {
                this.contacts = this.extractContactsFromGroups(response.contactGroups || []);
                this.state.cache.contacts = this.contacts;
                this.state.cache.lastUpdated = Date.now();

                // DEBUG: Analisar estrutura dos grupos
                console.log('👥 Estrutura dos grupos:', response.contactGroups.slice(0, 2));

                this.renderContacts();
                this.renderGroupFilters();

                console.log(`✅ ${this.contacts.length} contatos carregados`);
                this.debugContactData(); // CHAMAR DEBUG

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
            const response = await this.apiRequest('/api/whatsapp/instances');
            if (response.success && Array.isArray(response.instances)) {
                const connected = response.instances.filter(inst => inst.status === 'connected').length;
                console.log(`📱 ${connected} instâncias conectadas`);
                return connected;
            }
            return 0;
        } catch (error) {
            console.error('Erro ao obter instâncias:', error);
            return 0;
        }
    }

    // RENDERIZAÇÃO
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
                <p>Adicione contatos através dos grupos</p>
            </div>
        `;
            return;
        }

        contactsList.innerHTML = contacts.map(contact => `
        <div class="contact-card" data-contact-id="${contact._id}">
            <div class="contact-header">
                <div class="contact-avatar">
                    ${contact.photo ?
                `<img src="${contact.photo}" alt="${contact.name}" onerror="this.style.display='none'">` :
                contact.name.charAt(0).toUpperCase()
            }
                </div>
                <div class="contact-info">
                    <h3>${this.escapeHtml(contact.name)}</h3>
                    <div class="contact-phone">${this.formatPhone(contact.phone)}</div>
                    ${contact.whatsappId ? `<div class="contact-waid">${contact.whatsappId}</div>` : ''}
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
            
            <!-- BADGE PARA CONTATOS CORRIGIDOS -->
            ${contact.originalData && this.isDefaultName(contact.originalData.name) ? `
                <div class="contact-badge corrected">
                    <i class="fas fa-magic"></i> Nome corrigido
                </div>
            ` : ''}
            
            <div class="contact-actions">
                <button class="btn-icon" onclick="agendaManager.viewContact('${contact._id}')" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>
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

        groupsList.innerHTML = this.groups.map(group => `
            <div class="group-card">
                <div class="group-header">
                    <div>
                        <h3>${this.escapeHtml(group.name)}</h3>
                        ${group.description ? `<p class="group-description">${this.escapeHtml(group.description)}</p>` : ''}
                    </div>
                    <span class="group-count">${group.contactCount || 0} contatos</span>
                </div>
                
                <div class="group-stats">
                    <small>Criado em ${this.formatDate(group.createdAt)}</small>
                    <small>Fonte: ${group.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}</small>
                </div>
                
                <div class="group-actions">
                    <button class="btn btn-secondary" onclick="agendaManager.viewGroupContacts('${group._id}')">
                        <i class="fas fa-eye"></i>
                        Ver Contatos
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderGroupFilters() {
        const filterGroup = document.getElementById('filterGroup');

        if (!filterGroup) return;

        const groupsOptions = this.groups.map(group =>
            `<option value="${group._id}">${this.escapeHtml(group.name)} (${group.contactCount || 0})</option>`
        ).join('');

        filterGroup.innerHTML = '<option value="">Todos os Grupos</option>' + groupsOptions;
    }

    viewContact(contactId) {
        const contact = this.contacts.find(c => c._id === contactId);
        if (contact) {
            this.showContactDetails(contact);
        }
    }

    showContactDetails(contact) {
        const modalHTML = `
            <div id="contactDetailsModal" class="modal">
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h3>Detalhes do Contato</h3>
                    <div class="contact-details">
                        <div class="detail-item">
                            <strong>Nome:</strong>
                            <span>${this.escapeHtml(contact.name)}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Telefone:</strong>
                            <span>${this.formatPhone(contact.phone)}</span>
                        </div>
                        ${contact.whatsappId ? `
                        <div class="detail-item">
                            <strong>WhatsApp ID:</strong>
                            <span>${contact.whatsappId}</span>
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <strong>Grupos:</strong>
                            <span>${contact.groups ? contact.groups.join(', ') : 'Nenhum'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal anterior se existir
        const existingModal = document.getElementById('contactDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('contactDetailsModal');

        // Configurar evento de fechamento
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.style.display = 'block';
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
                                        ${contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div class="contact-info-modal">
                                        <strong>${this.escapeHtml(contact.name)}</strong>
                                        <span>${this.formatPhone(contact.phone)}</span>
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

        // Remover modal anterior se existir
        const existingModal = document.getElementById('groupContactsModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('groupContactsModal');

        // Configurar evento de fechamento
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.style.display = 'block';
    }

    // FILTROS E BUSCA
    filterContacts() {
        let filteredContacts = this.contacts;

        if (this.state.filters.search) {
            const searchTerm = this.state.filters.search.toLowerCase();
            filteredContacts = filteredContacts.filter(contact =>
                contact.name.toLowerCase().includes(searchTerm) ||
                contact.phone.includes(searchTerm)
            );
        }

        if (this.state.filters.group) {
            filteredContacts = filteredContacts.filter(contact =>
                contact.groupIds && contact.groupIds.includes(this.state.filters.group)
            );
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
        }

        this.renderContacts(sortedContacts);
    }

    // Método melhorado para extrair e limpar dados dos contatos
    extractAndCleanContactsFromGroups(groups) {
        const contactsMap = new Map();

        groups.forEach(group => {
            if (group.contacts && Array.isArray(group.contacts)) {
                group.contacts.forEach(contact => {
                    const contactId = contact._id || `${contact.phone}-${contact.name}`;

                    if (!contactsMap.has(contactId)) {
                        // PROCESSAMENTO MELHORADO DOS DADOS
                        const cleanedContact = this.cleanContactData(contact, group);

                        contactsMap.set(contactId, {
                            _id: contactId,
                            name: cleanedContact.name,
                            phone: cleanedContact.phone,
                            whatsappId: cleanedContact.whatsappId,
                            photo: cleanedContact.photo,
                            groups: [group.name],
                            groupIds: [group._id],
                            createdAt: contact.createdAt || group.createdAt,
                            // Campos adicionais para debug
                            originalData: {
                                name: contact.name,
                                phone: contact.phone,
                                whatsappId: contact.whatsappId
                            }
                        });
                    } else {
                        // Adicionar grupo ao contato existente
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

    // NOVO MÉTODO PARA LIMPEZA DOS DADOS
    cleanContactData(contact, group) {
        let { name, phone, whatsappId, photo } = contact;

        console.log('🧹 Limpando dados do contato:', { name, phone, whatsappId });

        // 1. CORRIGIR NOME
        if (this.isDefaultName(name)) {
            name = this.generateBetterName(phone, whatsappId, group.name);
            console.log(`🔄 Nome corrigido: "${contact.name}" -> "${name}"`);
        }

        // 2. CORRIGIR TELEFONE
        phone = this.cleanPhoneNumber(phone);

        // 3. CORRIGIR WHATSAPP ID
        whatsappId = this.cleanWhatsAppId(whatsappId, phone);

        return { name, phone, whatsappId, photo };
    }

    // VERIFICAR SE É NOME DEFAULT
    isDefaultName(name) {
        const defaultPatterns = [
            /^user-/i,
            /^\d+$/,
            /^user\d+$/i,
            /^contacto?\d*$/i,
            /^unknown/i,
            /^sem nome/i,
            /^null$/i,
            /^undefined$/i
        ];

        return defaultPatterns.some(pattern => pattern.test(name)) ||
            !name ||
            name.trim() === '' ||
            name.length < 2;
    }

    // GERAR NOME MELHOR
    generateBetterName(phone, whatsappId, groupName) {
        // Tentar extrair do WhatsApp ID
        if (whatsappId && whatsappId.includes('@')) {
            const numberPart = whatsappId.split('@')[0];
            if (numberPart.length >= 8) {
                return `Contato ${numberPart.slice(-8)}`;
            }
        }

        // Tentar extrair do telefone
        if (phone && phone.length >= 8) {
            const cleanPhone = phone.replace(/\D/g, '');
            return `Contato ${cleanPhone.slice(-8)}`;
        }

        // Usar grupo como referência
        if (groupName && groupName !== 'undefined') {
            return `Contato ${groupName.slice(0, 15)}`;
        }

        return 'Contato Sem Nome';
    }

    // LIMPAR NÚMERO DE TELEFONE
    cleanPhoneNumber(phone) {
        if (!phone) return 'N/A';

        // Remover caracteres não numéricos
        let clean = phone.replace(/\D/g, '');

        // Remover prefixos comuns
        if (clean.startsWith('55')) {
            clean = clean.slice(2);
        }

        if (clean.startsWith('0')) {
            clean = clean.slice(1);
        }

        // Formatar (XX) XXXXX-XXXX
        if (clean.length === 11) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
        }

        if (clean.length === 10) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
        }

        return clean;
    }

    // LIMPAR WHATSAPP ID
    cleanWhatsAppId(whatsappId, phone) {
        if (!whatsappId) {
            // Gerar WhatsApp ID a partir do telefone
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length >= 10) {
                return `${cleanPhone}@c.us`;
            }
            return null;
        }

        // Corrigir domínio incompleto
        if (whatsappId.includes('@lid')) {
            return whatsappId.replace('@lid', '@c.us');
        }

        if (!whatsappId.includes('@')) {
            return `${whatsappId}@c.us`;
        }

        return whatsappId;
    }


    // Adicione este método na classe AgendaManager para debug
    debugContactData() {
        console.log('🔍 DEBUG - Estrutura dos dados de contato:');

        if (this.contacts.length > 0) {
            const sampleContact = this.contacts[0];
            console.log('📋 Contato exemplo:', sampleContact);

            // Verificar a estrutura completa
            console.log('📊 Estrutura completa:', JSON.stringify(sampleContact, null, 2));
        }

        // Verificar a resposta da API
        console.log('🌐 Última resposta da API /api/contact-groups:');
        // Vamos modificar o loadContacts para salvar a resposta bruta
    }

    // MÉTODOS DE NAVEGAÇÃO
    showSection(sectionId) {
        if (!this.isAuthenticated()) {
            this.showNotification('Faça login para acessar esta seção', 'error');
            return;
        }

        // Atualizar navegação
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Atualizar seções
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

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
            localStorage.removeItem('authToken'); // MUDOU PARA localStorage
            localStorage.removeItem('user'); // MUDOU PARA localStorage
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
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
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