// ===== GLOBAL AUTH INSTANCE =====
let authInstance = null;

// ===== AUTH CLASS =====
// Update existing classes to use new systems
class Auth {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user'));
        this.init();
    }
    init() {
        this.checkAuth();
        this.setupEventListeners();
        authInstance = this; // Set global instance
    }

    async login() {
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;

        if (!email || !password) {
            this.showNotification('Email e senha são obrigatórios', 'error');
            return;
        }

        if (!SecurityManager.validateEmail(email)) {
            this.showNotification('Email inválido', 'error');
            return;
        }

        try {
            this.showLoading();

            // Use state manager for pending requests
            const requestId = `login_${Date.now()}`;
            stateManager.state.pendingRequests.set(requestId, true);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = SecurityManager.sanitizeObject(data.user);

                localStorage.setItem('authToken', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));

                // Update state manager
                stateManager.setState('user', this.user);
                stateManager.state.pendingRequests.delete(requestId);

                this.showNotification('Login realizado com sucesso!', 'success');
            } else {
                throw new Error(data.error || 'Erro no login');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }



    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.register();
            });
        }

        // Toggle between login and register
        const showRegister = document.getElementById('showRegister');
        if (showRegister) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegister();
            });
        }

        const showLogin = document.getElementById('showLogin');
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLogin();
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
    }

    showRegister() {
        const loginCard = document.getElementById('loginForm')?.closest('.login-card');
        const registerCard = document.getElementById('registerCard');

        if (loginCard) loginCard.style.display = 'none';
        if (registerCard) registerCard.style.display = 'block';
    }

    showLogin() {
        const registerCard = document.getElementById('registerCard');
        const loginCard = document.getElementById('loginForm')?.closest('.login-card');

        if (registerCard) registerCard.style.display = 'none';
        if (loginCard) loginCard.style.display = 'block';
    }

    async login() {
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;

        if (!email || !password) {
            this.showNotification('Email e senha são obrigatórios', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            console.log('Login response data:', data);

            if (data.success) {
                this.token = data.token;
                this.user = data.user;

                localStorage.setItem('authToken', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));

                this.showNotification('Login realizado com sucesso!', 'success');
                this.showDashboard();
            } else {
                throw new Error(data.error || 'Erro no login');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async register() {
        const name = document.getElementById('regName')?.value;
        const email = document.getElementById('regEmail')?.value;
        const password = document.getElementById('regPassword')?.value;

        if (!name || !email || !password) {
            this.showNotification('Todos os campos são obrigatórios', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Conta criada com sucesso! Faça login.', 'success');
                this.showLogin();
            } else {
                throw new Error(data.error || 'Erro no registro');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.token = null;
        this.user = null;

        this.showLoginSection();
        this.showNotification('Logout realizado com sucesso!', 'success');
    }

    checkAuth() {
        if (this.token && this.user) {
            this.showDashboard();
        } else {
            this.showLoginSection();
        }
    }

    showLoginSection() {
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const logoutBtn = document.getElementById('logoutBtn');

        if (loginSection) loginSection.classList.add('active');
        if (dashboardSection) dashboardSection.classList.remove('active');
        if (logoutBtn) logoutBtn.style.display = 'none';
    }

    showDashboard() {
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const logoutBtn = document.getElementById('logoutBtn');

        if (loginSection) loginSection.classList.remove('active');
        if (dashboardSection) dashboardSection.classList.add('active');
        if (logoutBtn) logoutBtn.style.display = 'block';

        // Update user info
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');

        if (userName) userName.textContent = this.user.name;
        if (userEmail) userEmail.textContent = this.user.email;
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) {
            console.warn('Elemento de notificação não encontrado');
            return;
        }

        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'flex';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }
}

// ===== CONTACT GROUPS CLASS =====
class ContactGroups {
    constructor() {
        this.currentGroup = null;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add group button
        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', () => {
                this.openGroupModal();
            });
        }

        // Group form submission
        const groupForm = document.getElementById('groupForm');
        if (groupForm) {
            groupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveGroup();
            });
        }

        // Add contact button
        const addContactBtn = document.getElementById('addContactBtn');
        if (addContactBtn) {
            addContactBtn.addEventListener('click', () => {
                this.addContactField();
            });
        }

        // Modal close
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                if (e.target.closest('#groupModal')) {
                    this.closeGroupModal();
                }
            });
        });
    }

    async loadGroups() {
        try {
            if (!authInstance) {
                console.error('Auth instance not available');
                return;
            }

            authInstance.showLoading();
            const response = await fetch('/api/contact-groups?limit=100', {
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.renderGroups(data.contactGroups);
            } else {
                throw new Error(data.error || 'Erro ao carregar grupos');
            }
        } catch (error) {
            if (authInstance) {
                authInstance.showNotification(error.message, 'error');
            }
        } finally {
            if (authInstance) {
                authInstance.hideLoading();
            }
        }
    }

    renderGroups(groups) {
        const container = document.getElementById('groupsList');
        if (!container) return;

        // Guarda os grupos originais para usar no filtro
        this.allGroups = groups;

        // Implementar um filtro de buscas
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            // Remove event listeners anteriores para evitar duplicação
            searchInput.replaceWith(searchInput.cloneNode(true));
            const newSearchInput = document.getElementById('searchInput');

            newSearchInput.addEventListener('input', () => {
                const query = newSearchInput.value.toLowerCase();
                const filteredGroups = this.allGroups.filter(group =>
                    group.name.toLowerCase().includes(query)
                );
                this.renderFilteredGroups(filteredGroups);
            });
        }

        this.renderFilteredGroups(groups);
    }

    renderFilteredGroups(groups) {
        const container = document.getElementById('groupsList');
        if (!container) return;

        if (!groups || groups.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users fa-3x"></i>
                <h3>Nenhum grupo encontrado</h3>
                <p>${this.allGroups && this.allGroups.length > 0 ?
                    'Nenhum grupo corresponde à sua pesquisa' :
                    'Comece criando seu primeiro grupo de contatos'}</p>
            </div>
        `;
            return;
        }

        container.innerHTML = groups.map(group => `
        <div class="list-item">
            <div class="list-item-info">
                <h4>${this.escapeHtml(group.name)}</h4>
                <p>${this.escapeHtml(group.description || 'Sem descrição')}</p>
                <small>${group.contactCount} contatos | Fonte: ${group.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}</small>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-secondary" onclick="app.contactGroups.editGroup('${group._id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="app.contactGroups.deleteGroup('${group._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    }

    // Função auxiliar para prevenir XSS
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    openGroupModal(group = null) {
        this.currentGroup = group;
        const modal = document.getElementById('groupModal');
        const title = document.getElementById('modalTitle');

        if (!modal || !title) return;

        if (group) {
            title.textContent = 'Editar Grupo';
            this.populateGroupForm(group);
        } else {
            title.textContent = 'Novo Grupo';
            this.clearGroupForm();
        }

        modal.style.display = 'block';
    }

    closeGroupModal() {
        const modal = document.getElementById('groupModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentGroup = null;
    }

    populateGroupForm(group) {
        const nameInput = document.getElementById('groupName');
        const descInput = document.getElementById('groupDescription');

        if (nameInput) nameInput.value = group.name;
        if (descInput) descInput.value = group.description || '';

        const contactsContainer = document.getElementById('contactsContainer');
        if (contactsContainer) {
            contactsContainer.innerHTML = '';

            if (group.contacts) {
                group.contacts.forEach(contact => {
                    this.addContactField(contact.name, contact.phone);
                });
            }
        }
    }

    clearGroupForm() {
        const form = document.getElementById('groupForm');
        const contactsContainer = document.getElementById('contactsContainer');

        if (form) form.reset();
        if (contactsContainer) contactsContainer.innerHTML = '';

        this.addContactField(); // Add one empty contact field
    }

    addContactField(name = '', phone = '') {
        const container = document.getElementById('contactsContainer');
        if (!container) return;

        const contactId = Date.now();

        const contactHtml = `
            <div class="contact-item" data-id="${contactId}">
                <input type="text" placeholder="Nome" value="${name}" required>
                <input type="tel" placeholder="Telefone (com DDD)" value="${phone}" required>
                <button type="button" class="remove-contact" onclick="app.contactGroups.removeContactField('${contactId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', contactHtml);
    }

    removeContactField(id) {
        const element = document.querySelector(`[data-id="${id}"]`);
        if (element) {
            element.remove();
        }
    }

    async saveGroup() {
        const nameInput = document.getElementById('groupName');
        const descInput = document.getElementById('groupDescription');

        if (!nameInput || !authInstance) return;

        const name = nameInput.value;
        const description = descInput ? descInput.value : '';

        // Collect contacts
        const contacts = [];
        const contactElements = document.querySelectorAll('.contact-item');

        contactElements.forEach(element => {
            const inputs = element.querySelectorAll('input');
            const name = inputs[0]?.value.trim();
            const phone = inputs[1]?.value.trim();

            if (name && phone) {
                contacts.push({ name, phone });
            }
        });

        if (contacts.length === 0) {
            authInstance.showNotification('Adicione pelo menos um contato', 'warning');
            return;
        }

        try {
            authInstance.showLoading();

            const url = this.currentGroup
                ? `/api/contact-groups/${this.currentGroup._id}`
                : '/api/contact-groups';

            const method = this.currentGroup ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: authInstance.getAuthHeaders(),
                body: JSON.stringify({ name, description, contacts })
            });

            const data = await response.json();

            if (data.success) {
                authInstance.showNotification(
                    this.currentGroup ? 'Grupo atualizado com sucesso!' : 'Grupo criado com sucesso!',
                    'success'
                );
                this.closeGroupModal();
                this.loadGroups();
            } else {
                throw new Error(data.error || 'Erro ao salvar grupo');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    async editGroup(groupId) {
        try {
            if (!authInstance) return;

            authInstance.showLoading();
            const response = await fetch(`/api/contact-groups/${groupId}`, {
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.openGroupModal(data.contactGroup);
            } else {
                throw new Error(data.error || 'Erro ao carregar grupo');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    async deleteGroup(groupId) {
        if (!confirm('Tem certeza que deseja excluir este grupo?') || !authInstance) {
            return;
        }

        try {
            authInstance.showLoading();
            const response = await fetch(`/api/contact-groups/${groupId}`, {
                method: 'DELETE',
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                authInstance.showNotification('Grupo excluído com sucesso!', 'success');
                this.loadGroups();
            } else {
                throw new Error(data.error || 'Erro ao excluir grupo');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }
}

// ===== WHATSAPP MANAGER CLASS =====
// ===== WHATSAPP MANAGER CLASS =====
class WhatsAppManager {
    constructor(authManager = null) {
        // Injeção de dependência
        this.auth = authManager || (typeof authInstance !== 'undefined' ? authInstance : null);

        // Estado centralizado
        this.state = {
            currentInstance: null,
            instances: [],
            qrCodeCheck: {
                interval: null,
                instanceId: null,
                attempts: 0,
                maxAttempts: 60 // 3 minutos (60 * 3s)
            },
            cache: {
                instances: null,
                lastUpdated: null,
                cacheTimeout: 5 * 60 * 1000 // 5 minutos
            }
        };

        // Event system para desacoplamento
        this.eventHandlers = {};
    }

    // Sistema de eventos para melhor comunicação
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
        }
    }

    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    init() {
        this.setupEventListeners();
        this.setupGlobalEventHandlers();
    }

    setupEventListeners() {
        console.log('Setting up WhatsAppManager event listeners');

        // Usar event delegation para o botão de adicionar instância
        document.addEventListener('click', (e) => {
            if (e.target.id === 'addInstanceBtn' || e.target.closest('#addInstanceBtn')) {
                e.preventDefault();
                console.log('Add Instance button clicked via delegation');
                this.openInstanceModal();
            }
        });

        // Add instance button - approach direta também
        const addInstanceBtn = document.getElementById('addInstanceBtn');
        if (addInstanceBtn) {
            console.log('Add Instance button found, attaching listener');
            // Remover listeners anteriores para evitar duplicação
            addInstanceBtn.replaceWith(addInstanceBtn.cloneNode(true));
            const newBtn = document.getElementById('addInstanceBtn');

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Add Instance button clicked directly');
                this.openInstanceModal();
            });
        } else {
            console.warn('Add Instance button not found in DOM');
        }

        // Instance form submission
        const instanceForm = document.getElementById('instanceForm');
        if (instanceForm) {
            instanceForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveInstance();
            });
        }

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
                this.stopQRCodeCheck();
            });
        });
    }

    setupGlobalEventHandlers() {
        // Fechar modais ao clicar fora
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
                if (e.target.id === 'qrcodeModal') {
                    this.stopQRCodeCheck();
                }
            }
        });

        // Tecla ESC para fechar modais
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        this.stopQRCodeCheck();
    }

    async loadInstances(forceRefresh = false) {
        try {
            if (!this.auth) {
                console.error('Auth manager not available');
                this.emit('error', new Error('Auth manager not available'));
                return;
            }

            // Verificar cache
            const now = Date.now();
            if (!forceRefresh &&
                this.state.cache.instances &&
                this.state.cache.lastUpdated &&
                (now - this.state.cache.lastUpdated) < this.state.cache.cacheTimeout) {
                console.log('Using cached instances');
                this.renderInstances(this.state.cache.instances);
                return;
            }

            this.auth.showLoading();
            const response = await fetch('/api/whatsapp/instances', {
                headers: this.auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                // Atualizar cache
                this.state.cache.instances = data.instances;
                this.state.cache.lastUpdated = Date.now();

                this.state.instances = data.instances;
                this.renderInstances(data.instances);
                this.emit('instancesLoaded', data.instances);
            } else {
                throw new Error(data.error || 'Erro ao carregar instâncias');
            }
        } catch (error) {
            console.error('Error loading instances:', error);
            this.emit('error', error);

            if (this.auth) {
                this.auth.showNotification(error.message, 'error');
            }
            this.renderInstances([]);
        } finally {
            if (this.auth) {
                this.auth.hideLoading();
            }
        }
    }

    renderInstances(instances) {
        const container = document.getElementById('instancesList');
        if (!container) return;

        if (!instances || instances.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fab fa-whatsapp fa-3x"></i>
                    <h3>Nenhuma instância encontrada</h3>
                    <p>Comece criando sua primeira instância do WhatsApp</p>
                </div>
            `;
            return;
        }

        container.innerHTML = instances.map(instance => {
            const hasQRCode = Boolean(instance.qrCodeReady || instance.qrCode);

            return `
            <div class="list-item" data-instance-id="${instance._id}">
                <div class="list-item-info">
                    <h4>${instance.sessionName}</h4>
                    <p>
                        Status: 
                        <span class="status-badge status-${instance.status}">
                            ${this.getStatusText(instance.status)}
                        </span>
                    </p>
                    <p>Número: ${instance.phoneNumber || 'Não conectado'}</p>
                    <small>Criado em: ${this.formatDate(instance.createdAt)}</small>
                </div>
                <div class="list-item-actions">
                    ${hasQRCode ? `
                        <button class="btn btn-info" onclick="app.whatsappManager.showQRCode('${instance._id}')">
                            <i class="fas fa-link"></i> Conectar WhatsApp
                        </button>
                    ` : ''}
                    
                    ${instance.status === 'connected' ? `
                        <button class="btn btn-success" onclick="app.whatsappManager.loadGroups('${instance._id}')">
                            <i class="fas fa-sync"></i> Carregar Grupos
                        </button>
                        <button class="btn btn-warning" onclick="app.whatsappManager.viewGroups('${instance._id}')">
                            <i class="fas fa-users"></i> Ver Grupos
                        </button>
                    ` : ''}
                    
                    ${instance.status === 'connected' ? `
                        <button class="btn btn-secondary" onclick="app.whatsappManager.disconnectInstance('${instance._id}')">
                            <i class="fas fa-power-off"></i> Desconectar
                        </button>
                    ` : ''}
                    
                    <button class="btn btn-danger" onclick="app.whatsappManager.deleteInstance('${instance._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        }).join('');

        this.emit('instancesRendered', instances);
    }

    getStatusText(status) {
        const statusMap = {
            'connected': 'Conectado',
            'connecting': 'Conectando...',
            'disconnected': 'Desconectado',
            'failed': 'Falha'
        };
        return statusMap[status] || status;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('pt-BR');
    }

    openInstanceModal(instance = null) {
        console.log('openInstanceModal called', { instance });

        this.state.currentInstance = instance;
        const modal = document.getElementById('instanceModal');
        const title = document.getElementById('instanceModalTitle');

        console.log('Modal elements:', { modal, title });

        if (!modal || !title) {
            console.error('Modal elements not found!');
            return;
        }

        if (instance) {
            title.textContent = 'Editar Instância';
            this.populateInstanceForm(instance);
        } else {
            title.textContent = 'Nova Instância WhatsApp';
            this.clearInstanceForm();
        }

        modal.style.display = 'block';
        console.log('Modal should be visible now');

        this.emit('modalOpened', { type: 'instance', instance });
    }

    closeInstanceModal() {
        const modal = document.getElementById('instanceModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.state.currentInstance = null;
        this.emit('modalClosed', { type: 'instance' });
    }

    populateInstanceForm(instance) {
        const nameInput = document.getElementById('instanceName');
        if (nameInput) {
            nameInput.value = instance.sessionName;
        }
    }

    clearInstanceForm() {
        const form = document.getElementById('instanceForm');
        if (form) {
            form.reset();
        }
    }

    // No arquivo app.js - WhatsAppManager class

    // No WhatsAppManager class - adicionar estado de loading
    async saveInstance() {
        console.log('saveInstance called');

        // ✅ PREVENIR MÚLTIPLOS CLICKS
        if (this.state.isSaving) {
            console.log('⚠️ Save já em andamento, ignorando clique');
            return;
        }

        const nameInput = document.getElementById('instanceName');
        if (!nameInput || !this.auth) {
            console.error('Auth manager or input not available');
            return;
        }

        const sessionName = nameInput.value.trim();
        console.log('Session name:', sessionName);

        if (!sessionName) {
            this.showNotification('Nome da instância é obrigatório', 'warning');
            return;
        }

        try {
            // ✅ BLOQUEAR NOVOS CLICKS
            this.state.isSaving = true;
            this.showLoading();

            // ✅ DESABILITAR BOTÃO ENQUANTO SALVA
            const submitBtn = document.querySelector('#instanceForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
            }

            const response = await fetch('/api/whatsapp/instances', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ sessionName })
            });

            const data = await response.json();
            console.log('API response:', data);

            if (data.success) {
                this.showNotification(
                    data.message || 'Instância criada com sucesso!',
                    'success'
                );

                this.state.cache.instances = null;
                this.state.cache.lastUpdated = null;

                this.closeInstanceModal();
                this.loadInstances(true);

                this.emit('instanceCreated', data.instance);

                // ✅ VERIFICAÇÃO SEGURA PARA QR CODE
                if (data.instance && data.instance._id) {
                    console.log('Instância criada com ID:', data.instance._id);

                    // Pequeno delay para garantir processamento
                    setTimeout(() => {
                        this.showQRCode(data.instance._id);
                    }, 1500);
                }
            } else {
                // ✅ TRATAMENTO ESPECÍFICO PARA DUPLICATE KEY
                if (data.error && data.error.includes('duplicate key')) {
                    throw new Error('Já existe uma instância com este nome. Por favor, escolha outro nome.');
                } else {
                    throw new Error(data.error || 'Erro ao criar instância');
                }
            }
        } catch (error) {
            console.error('Erro ao salvar instância:', error);
            this.emit('error', error);

            // ✅ MENSAGEM MAIS AMIGÁVEL
            let userMessage = error.message;
            if (error.message.includes('Cannot read properties of null')) {
                userMessage = 'Erro no servidor ao criar instância. A instância pode ter sido criada parcialmente. Verifique a lista.';
            }

            this.showNotification(userMessage, 'error');
        } finally {
            // ✅ RESTAURAR ESTADO
            this.state.isSaving = false;
            this.hideLoading();

            // ✅ REABILITAR BOTÃO
            const submitBtn = document.querySelector('#instanceForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Criar Instância';
            }
        }
    }

    // No arquivo app.js - WhatsAppManager class

    async showQRCode(instanceId) {
        try {
            if (!this.auth) return;

            this.auth.showLoading();
            const response = await fetch(`/api/whatsapp/instances/${instanceId}/qrcode`, {
                headers: this.auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success && data.qrCode) {
                this.openQRCodeModal(instanceId, data.qrCode);
                this.emit('qrcodeShown', { instanceId, qrCode: data.qrCode });
            } else {
                throw new Error(data.error || 'QR Code não disponível');
            }
        } catch (error) {
            console.error('Erro ao buscar QR Code:', error);
            this.emit('error', error);

            // ✅ CORREÇÃO: Mensagem mais específica
            if (error.message.includes('já estar conectada')) {
                this.auth.showNotification('Instância já está conectada!', 'info');
                this.loadInstances(true); // Recarregar status
            } else {
                this.auth.showNotification(error.message, 'error');
            }
        } finally {
            this.auth.hideLoading();
        }
    }

    openQRCodeModal(instanceId, qrCode) {
        const modal = document.getElementById('qrcodeModal');
        const qrImage = document.getElementById('qrcodeImage');

        if (!modal || !qrImage) {
            this.auth.showNotification('Elementos do modal de QR Code não encontrados', 'error');
            return;
        }

        qrImage.src = qrCode;
        qrImage.alt = 'QR Code para conectar WhatsApp';

        modal.style.display = 'block';

        this.startQRCodeCheck(instanceId);
        this.emit('modalOpened', { type: 'qrcode', instanceId });
    }

    closeQRCodeModal() {
        const modal = document.getElementById('qrcodeModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.stopQRCodeCheck();
        this.emit('modalClosed', { type: 'qrcode' });
    }

    startQRCodeCheck(instanceId) {
        this.stopQRCodeCheck(); // Cleanup anterior

        this.state.qrCodeCheck.instanceId = instanceId;
        this.state.qrCodeCheck.attempts = 0;

        this.state.qrCodeCheck.interval = setInterval(async () => {
            try {
                this.state.qrCodeCheck.attempts++;

                const response = await fetch(`/api/whatsapp/instances/${instanceId}`, {
                    headers: this.auth.getAuthHeaders()
                });

                const data = await response.json();

                if (data.success && data.instance) {
                    if (data.instance.status === 'connected') {
                        this.auth.showNotification('WhatsApp conectado com sucesso!', 'success');
                        this.closeQRCodeModal();

                        // Invalidar cache
                        this.state.cache.instances = null;
                        this.state.cache.lastUpdated = null;

                        this.loadInstances(true); // Force refresh
                        this.emit('instanceConnected', data.instance);
                    } else if (data.instance.status === 'failed') {
                        this.auth.showNotification('Falha ao conectar WhatsApp', 'error');
                        this.closeQRCodeModal();
                        this.emit('connectionFailed', data.instance);
                    }
                }

                // Timeout após máximo de tentativas
                if (this.state.qrCodeCheck.attempts >= this.state.qrCodeCheck.maxAttempts) {
                    this.stopQRCodeCheck();
                    this.auth.showNotification('Tempo esgotado para escanear QR Code', 'warning');
                    this.emit('qrcodeTimeout', { instanceId, attempts: this.state.qrCodeCheck.attempts });
                }

            } catch (error) {
                console.error('Erro ao verificar status:', error);
                this.emit('error', error);
            }
        }, 3000);
    }

    stopQRCodeCheck() {
        if (this.state.qrCodeCheck.interval) {
            clearInterval(this.state.qrCodeCheck.interval);
            this.state.qrCodeCheck.interval = null;
            this.state.qrCodeCheck.instanceId = null;
            this.state.qrCodeCheck.attempts = 0;
        }
    }

    async loadGroups(instanceId) {
        if (!confirm('Deseja carregar os grupos do WhatsApp? Isso pode levar alguns segundos.') || !this.auth) {
            return;
        }

        try {
            this.auth.showLoading();
            const response = await fetch(`/api/whatsapp/instances/${instanceId}/load-groups`, {
                method: 'POST',
                headers: this.auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.auth.showNotification(`${data.groupCount} grupos carregados com sucesso!`, 'success');
                this.emit('groupsLoaded', { instanceId, groupCount: data.groupCount });

                if (app && app.contactGroups) {
                    app.contactGroups.loadGroups();
                }
            } else {
                throw new Error(data.error || 'Erro ao carregar grupos');
            }
        } catch (error) {
            this.emit('error', error);
            this.auth.showNotification(error.message, 'error');
        } finally {
            this.auth.hideLoading();
        }
    }

    async viewGroups(instanceId) {
        try {
            if (!this.auth) return;

            this.auth.showLoading();
            const response = await fetch(`/api/whatsapp/instances/${instanceId}/groups`, {
                headers: this.auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showGroupsModal(data.groups);
                this.emit('groupsViewed', { instanceId, groups: data.groups });
            } else {
                throw new Error(data.error || 'Erro ao carregar grupos');
            }
        } catch (error) {
            this.emit('error', error);
            this.auth.showNotification(error.message, 'error');
        } finally {
            this.auth.hideLoading();
        }
    }

    showGroupsModal(groups) {
        const modal = document.getElementById('groupsModal');
        const container = document.getElementById('whatsappGroupsList');

        if (!modal || !container) {
            this.auth.showNotification('Elementos do modal de grupos não encontrados', 'error');
            return;
        }

        if (!groups || groups.length === 0) {
            container.innerHTML = '<p>Nenhum grupo encontrado no WhatsApp.</p>';
        } else {
            container.innerHTML = groups.map(group => `
                <div class="group-item">
                    <h4>${group.name}</h4>
                    <p>${group.contactCount || 0} participantes</p>
                    <div class="group-participants">
                        ${group.contacts ? group.contacts.slice(0, 5).map(contact => `
                            <span class="participant">${contact.name || 'Sem nome'}</span>
                        `).join('') : ''}
                        ${group.contactCount > 5 ? `<span>+${group.contactCount - 5} mais</span>` : ''}
                    </div>
                </div>
            `).join('');
        }

        modal.style.display = 'block';
        this.emit('modalOpened', { type: 'groups', groups });
    }

    closeGroupsModal() {
        const modal = document.getElementById('groupsModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.emit('modalClosed', { type: 'groups' });
    }

    // No arquivo app.js - WhatsAppManager class

    async disconnectInstance(instanceId) {
        if (!confirm('Tem certeza que deseja desconectar esta instância?') || !this.auth) {
            return;
        }

        try {
            this.auth.showLoading();

            // ✅ CORREÇÃO: Usar :id na rota de disconnect (conforme suas rotas)
            const response = await fetch(`/api/whatsapp/instances/${instanceId}/disconnect`, {
                method: 'PUT',
                headers: this.auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.auth.showNotification('Instância desconectada com sucesso!', 'success');

                // Invalidar cache
                this.state.cache.instances = null;
                this.state.cache.lastUpdated = null;

                this.loadInstances(true); // Force refresh
                this.emit('instanceDisconnected', { instanceId });
            } else {
                throw new Error(data.error || 'Erro ao desconectar instância');
            }
        } catch (error) {
            this.emit('error', error);
            this.auth.showNotification(error.message, 'error');
        } finally {
            this.auth.hideLoading();
        }
    }

    // No arquivo app.js - WhatsAppManager class

    async deleteInstance(instanceId) {
        if (!confirm('Tem certeza que deseja excluir esta instância? Isso irá remover todas as credenciais e você precisará escanear o QR code novamente.') || !this.auth) {
            return;
        }

        try {
            this.auth.showLoading();

            // PRIMEIRO: Buscar a instância para obter o sessionName
            const instanceResponse = await fetch(`/api/whatsapp/instances/${instanceId}`, {
                headers: this.auth.getAuthHeaders()
            });

            const instanceData = await instanceResponse.json();

            if (!instanceData.success) {
                throw new Error(instanceData.error || 'Erro ao buscar instância');
            }

            const sessionName = instanceData.instance.sessionName;
            console.log('Deletando instância:', sessionName);

            // ✅ CORREÇÃO: Usar sessionName na URL de delete
            const response = await fetch(`/api/whatsapp/instances/${sessionName}`, {
                method: 'DELETE',
                headers: this.auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.auth.showNotification('Instância excluída com sucesso!', 'success');

                // Invalidar cache
                this.state.cache.instances = null;
                this.state.cache.lastUpdated = null;

                this.loadInstances(true); // Force refresh
                this.emit('instanceDeleted', { instanceId, sessionName });
            } else {
                throw new Error(data.error || 'Erro ao excluir instância');
            }
        } catch (error) {
            this.emit('error', error);
            this.auth.showNotification(error.message, 'error');
        } finally {
            this.auth.hideLoading();
        }
    }

    // Métodos utilitários para gerenciamento de estado
    getInstance(instanceId) {
        return this.state.instances.find(inst => inst._id === instanceId);
    }

    getConnectedInstances() {
        return this.state.instances.filter(inst => inst.status === 'connected');
    }

    showNotification(message, type) {
        if (this.auth && typeof this.auth.showNotification === 'function') {
            this.auth.showNotification(message, type);
        } else if (typeof authInstance !== 'undefined' && authInstance.showNotification) {
            authInstance.showNotification(message, type);
        } else {
            // Fallback básico
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    showLoading() {
        if (this.auth && typeof this.auth.showLoading === 'function') {
            this.auth.showLoading();
        } else if (typeof authInstance !== 'undefined' && authInstance.showLoading) {
            authInstance.showLoading();
        }
    }

    hideLoading() {
        if (this.auth && typeof this.auth.hideLoading === 'function') {
            this.auth.hideLoading();
        } else if (typeof authInstance !== 'undefined' && authInstance.hideLoading) {
            authInstance.hideLoading();
        }
    }

    getAuthHeaders() {
        if (this.auth && typeof this.auth.getAuthHeaders === 'function') {
            return this.auth.getAuthHeaders();
        } else if (typeof authInstance !== 'undefined' && authInstance.getAuthHeaders) {
            return authInstance.getAuthHeaders();
        } else {
            console.warn('No auth manager available for headers');
            return {};
        }
    }

    // Cleanup para evitar memory leaks
    destroy() {
        this.stopQRCodeCheck();
        this.eventHandlers = {};
    }
}

// Atualize a classe Batches no app.js - SUBSTITUA A CLASSE EXISTENTE:

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

// ===== MAIN APP CLASS =====
class App {
    constructor() {
        this.currentSection = 'contactGroupsSection';
        this.stateManager = stateManager;
        this.themeManager = null;
        this.auth = null;
        this.contactGroups = null;
        this.whatsappManager = null;
        this.batches = null;
        this.init();
    }

    async init() {
        try {
            // Initialize core systems first
            await this.initializeCoreSystems();

            // Then initialize feature modules
            this.initializeModules();
            this.setupNavigation();
            this.setupSectionLoading();

            // Make available globally
            window.app = this;

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showFatalError('Falha ao inicializar a aplicação');
        }
    }

    async initializeCoreSystems() {
        // Initialize theme manager
        this.themeManager = new ThemeManager();

        // Initialize Auth FIRST - porque outros módulos dependem dele
        this.auth = new Auth();
        console.log('Auth system initialized');

        // Initialize state manager subscriptions
        this.setupStateSubscriptions();

        // Initialize error handling
        this.setupErrorHandling();
    }

    setupStateSubscriptions() {
        // Theme changes
        this.stateManager.subscribe('theme', (theme) => {
            document.body.setAttribute('data-theme', theme);
        });

        // Loading state
        this.stateManager.subscribe('loading', (loading) => {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = loading ? 'flex' : 'none';
            }
        });

        // User state
        this.stateManager.subscribe('user', (user) => {
            if (user) {
                this.showDashboard();
            } else {
                this.showLoginSection();
            }
        });
    }

    debugWhatsAppSection() {
        console.log('=== DEBUG WHATSAPP SECTION ===');
        console.log('Current section:', this.currentSection);
        console.log('WhatsAppManager:', this.whatsappManager);
        console.log('Auth:', this.auth);

        const addInstanceBtn = document.getElementById('addInstanceBtn');
        console.log('Add Instance Button:', addInstanceBtn);

        const instanceModal = document.getElementById('instanceModal');
        console.log('Instance Modal:', instanceModal);

        const whatsappSection = document.getElementById('whatsappSection');
        console.log('WhatsApp Section active:', whatsappSection?.classList.contains('active'));

        console.log('=== END DEBUG ===');
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showNotification('Ocorreu um erro inesperado', 'error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showNotification('Erro na operação', 'error');
        });
    }

    showFatalError(message) {
        const errorHtml = `
            <div style="padding: 2rem; text-align: center;">
                <i class="fas fa-exclamation-triangle fa-3x" style="color: var(--danger-color); margin-bottom: 1rem;"></i>
                <h2>Erro Crítico</h2>
                <p>${SecurityManager.sanitizeHTML(message)}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Recarregar Aplicação
                </button>
            </div>
        `;
        document.body.innerHTML = errorHtml;
    }

    initializeModules() {
        console.log('Initializing modules...');

        // Initialize ContactGroups
        this.contactGroups = new ContactGroups();
        this.contactGroups.init();
        console.log('ContactGroups initialized');

        // // Initialize AgendaManager
        // this.agendaManager = new AgendaManager(this.auth);
        // this.agendaManager.init();
        // console.log('AgendaManager initialized');

        // Initialize WhatsAppManager - garantir que auth está disponível
        if (this.auth) {
            this.whatsappManager = new WhatsAppManager(this.auth);
            this.whatsappManager.init();
            console.log('WhatsApp Manager initialized with auth dependency');
        } else {
            console.error('Auth not available for WhatsAppManager initialization');

            // Tentar novamente após um delay
            setTimeout(() => {
                if (this.auth) {
                    this.whatsappManager = new WhatsAppManager(this.auth);
                    this.whatsappManager.init();
                    console.log('WhatsApp Manager initialized after retry');
                }
            }, 1000);
        }

        // Initialize Batches
        this.batches = new Batches();
        this.batches.init();
        console.log('Batches initialized');
    }

    testWhatsAppManager() {
        const addInstanceBtn = document.getElementById('addInstanceBtn');
        if (addInstanceBtn) {
            console.log('✅ Add Instance button found in DOM');
            console.log('✅ WhatsAppManager instance:', this.whatsappManager);
            console.log('✅ WhatsAppManager auth:', this.whatsappManager.auth);
        } else {
            console.warn('❌ Add Instance button not found in DOM');
        }
    }

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-section');
                this.showSection(section);
            });
        });
    }

    setupSectionLoading() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('active')) {
                        this.loadSectionData(target.id);
                    }
                }
            });
        });

        document.querySelectorAll('.content-section').forEach(section => {
            observer.observe(section, { attributes: true });
        });
    }

    showSection(sectionId) {
        console.log('Showing section:', sectionId);

        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            console.log('Active nav button:', activeBtn);
        }

        // Update sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            console.log('Active section:', targetSection);
        } else {
            console.warn('Section not found:', sectionId);
        }

        this.currentSection = sectionId;

        // Load section data immediately
        this.loadSectionData(sectionId);
    }

    loadSectionData(sectionId) {
        console.log('Loading data for section:', sectionId);

        switch (sectionId) {
            case 'contactGroupsSection':
                if (this.contactGroups) {
                    console.log('Loading contact groups...');
                    this.contactGroups.loadGroups();
                }
                break;
            case 'whatsappSection':
                if (this.whatsappManager) {
                    console.log('Loading WhatsApp instances...');
                    this.whatsappManager.loadInstances();

                    // Re-configurar event listeners para garantir que funcionam
                    setTimeout(() => {
                        this.whatsappManager.setupEventListeners();
                    }, 100);
                } else {
                    console.warn('WhatsAppManager not available, retrying...');
                    // Tentar inicializar se não estiver disponível
                    setTimeout(() => {
                        if (this.auth && !this.whatsappManager) {
                            this.whatsappManager = new WhatsAppManager(this.auth);
                            this.whatsappManager.init();
                            this.whatsappManager.loadInstances();
                        }
                    }, 500);
                }
                break;
            case 'batchesSection':
                console.log('Batches section activated');
                this.batches.loadBatches();
                break;
            default:
                console.log('Unknown section:', sectionId);
        }
    }

    // Helper method para compatibilidade
    showNotification(message, type) {
        if (this.auth && typeof this.auth.showNotification === 'function') {
            this.auth.showNotification(message, type);
        } else {
            // Fallback
            console.log(`${type}: ${message}`);
        }
    }
}

// Global utility functions
function formatPhone(phone) {
    return phone.replace(/\D/g, '');
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString('pt-BR');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

// No final do arquivo app.js
window.debugWhatsApp = {
    testDelete: async function (instanceId) {
        if (!instanceId) {
            // Buscar primeira instância
            const instances = await fetch('/api/whatsapp/instances', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            }).then(r => r.json());

            if (instances.success && instances.instances.length > 0) {
                instanceId = instances.instances[0]._id;
                console.log('Usando instância:', instances.instances[0]);
            }
        }

        if (instanceId && window.app && window.app.whatsappManager) {
            console.log('Testando delete para ID:', instanceId);
            await window.app.whatsappManager.deleteInstance(instanceId);
        }
    },

    testCreate: async function () {
        if (window.app && window.app.whatsappManager) {
            const testName = 'test-' + Date.now();
            console.log('Testando criação:', testName);

            // Simular criação
            const response = await fetch('/api/whatsapp/instances', {
                method: 'POST',
                headers: window.app.auth.getAuthHeaders(),
                body: JSON.stringify({ sessionName: testName })
            });

            const data = await response.json();
            console.log('Resultado criação:', data);
        }
    },

    listInstances: async function () {
        const instances = await fetch('/api/whatsapp/instances', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }).then(r => r.json());

        console.log('Instâncias:', instances);
        return instances;
    }
};