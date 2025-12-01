// ===== GLOBAL AUTH INSTANCE =====
let authInstance = null;

// ===== AUTH CLASS =====
// Update existing classes to use new systems
class Auth {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user'));
        this.isAdmin = null
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
        const isAdminBtn = document.getElementById('adminButton');

        if (loginSection) loginSection.classList.add('active');
        if (dashboardSection) dashboardSection.classList.remove('active');
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (isAdminBtn) isAdminBtn.style.display = 'none';

    }


    showDashboard() {
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const logoutBtn = document.getElementById('logoutBtn');
        const isAdminBtn = document.getElementById('adminButton');



        if (loginSection) loginSection.classList.remove('active');
        if (dashboardSection) dashboardSection.classList.add('active');
        if (logoutBtn) logoutBtn.style.display = 'block';
        this.isAdmin = this.user["role"]
        console.log("User role:", this.isAdmin);
        if (this.isAdmin === "admin") {
            isAdminBtn.style.display = 'block'
            isAdminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '../admin.html'

            })
        }



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
            isSaving: false,
            qrCodeCheck: {
                intervalId: null,
                instanceId: null,
                attempts: 0,
                maxAttempts: 60, // 3 minutos (60 * 3s)
                delayMs: 3000
            },
            cache: {
                instances: null,
                lastUpdated: null,
                cacheTimeout: 5 * 60 * 1000 // 5 minutos
            }
        };

        // Event system para desacoplamento
        this.eventHandlers = {};

        // Armazenar references de event listeners para remover depois
        this._bound = {
            documentClick: this._handleDocumentClick.bind(this),
            keydown: this._handleKeydown.bind(this),
            windowClick: this._handleWindowClick.bind(this),
            instanceListClick: this._handleInstanceListClick.bind(this)
        };

        // AbortController padrão para requisições longas
        this._defaultRequestTimeout = 15000; // ms
    }

    updateAddInstanceButton() {
        const addInstanceBtn = document.getElementById('addInstanceBtn');
        if (!addInstanceBtn) return;

        const connectedInstances = this.getConnectedInstances();

        if (connectedInstances.length > 0) {
            // Já existe uma instância conectada - desabilitar botão
            addInstanceBtn.disabled = true;
            addInstanceBtn.title = 'Já existe uma instância conectada. Desconecte-a antes de criar uma nova.';
            addInstanceBtn.style.opacity = '0.6';
            addInstanceBtn.style.cursor = 'not-allowed';
        } else {
            // Nenhuma instância conectada - habilitar botão
            addInstanceBtn.disabled = false;
            addInstanceBtn.title = 'Criar nova instância do WhatsApp';
            addInstanceBtn.style.opacity = '1';
            addInstanceBtn.style.cursor = 'pointer';
        }
    }

    /* ---------------------- EventEmitter simples --------------------- */
    on(event, handler) {
        if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
        this.eventHandlers[event].push(handler);
    }

    off(event, handler) {
        if (!this.eventHandlers[event]) return;
        this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }

    emit(event, data) {
        if (!this.eventHandlers[event]) return;
        for (const handler of this.eventHandlers[event]) {
            try {
                handler(data);
            } catch (err) {
                console.error(`Error in event handler for ${event}:`, err);
            }
        }
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Inicialização ---------------------------- */
    init() {
        this.setupEventListeners();
        this.setupGlobalEventHandlers();
    }

    setupEventListeners() {

        // Add instance button - LISTENER DIRETO
        const addInstanceBtn = document.getElementById('addInstanceBtn');
        if (addInstanceBtn) {
            console.log('✅ Configurando listener para botão Nova Instância');
            addInstanceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('✅ Botão Nova Instância clicado');
                this.openInstanceModal();
            });
        }


        // Delegation: clicks no documento para botões da UI (sempre prefira data-action/data-id)
        document.addEventListener('click', this._bound.documentClick);

        // Listener específico para lista de instâncias (delegation dentro do container)
        const instancesList = document.getElementById('instancesList');
        if (instancesList) {
            instancesList.addEventListener('click', this._bound.instanceListClick);
        }

        // Form submit
        const instanceForm = document.getElementById('instanceForm');
        if (instanceForm) {
            // Use named handler para poder remover
            instanceForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveInstance();
            });
        }

        // Close buttons (delegation também poderia funcionar)
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
                this.stopQRCodeCheck();
            });
        });
    }

    async saveInstance() {
        // Evitar múltiplos clicks
        if (this.state.isSaving) {
            console.log('Save já em andamento');
            return;
        }

        const nameInput = document.getElementById('instanceName');
        if (!nameInput) {
            this.showNotification('Campo de nome não encontrado', 'error');
            return;
        }

        const sessionName = nameInput.value.trim();
        if (!sessionName) {
            this.showNotification('Nome da instância é obrigatório', 'warning');
            return;
        }

        const submitBtn = document.querySelector('#instanceForm button[type="submit"]');

        try {
            this.state.isSaving = true;
            this.showLoading();
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.originalHtml = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
            }

            const payload = { sessionName };

            const data = await this._fetchJson('/api/whatsapp/instances', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (data && data.success) {
                this.showNotification(data.message || 'Instância criada com sucesso!', 'success');

                // Invalidar cache
                this.state.cache.instances = null;
                this.state.cache.lastUpdated = null;

                this.closeInstanceModal();
                await this.loadInstances(true);
                this.emit('instanceCreated', data.instance);

                if (data.instance && data.instance._id) {
                    // Tentar obter QR Code com 4 tentativas
                    await this.retryQRCodeFetch(data.instance._id);
                }
            } else {
                // Tratamento específico
                const msg = data && data.error ? data.error : 'Erro ao criar instância';
                if (msg.includes('duplicate key')) {
                    throw new Error('Já existe uma instância com este nome. Escolha outro nome.');
                }
                throw new Error(msg);
            }
        } catch (error) {
            console.error('Erro ao salvar instância:', error);
            this.emit('error', error);
            const userMessage = (error.message && error.message.includes('Cannot read properties of null'))
                ? 'Erro no servidor ao criar instância. Verifique a lista.' : (error.message || 'Erro desconhecido');
            this.showNotification(userMessage, 'error');
        } finally {
            this.state.isSaving = false;
            this.hideLoading();
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtn.dataset.originalHtml || 'Criar Instância';
                delete submitBtn.dataset.originalHtml;
            }
        }
    }

    // Nova função para tentar obter QR Code com retentativas
    async retryQRCodeFetch(instanceId, maxAttempts = 10, delayMs = 5000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`Tentativa ${attempt} de ${maxAttempts} para obter QR Code...`);

                // Aguardar antes de cada tentativa (exceto a primeira)
                if (attempt > 1) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                // Verificar se a instância ainda existe e está aguardando QR Code
                const statusData = await this._fetchJson(`/api/whatsapp/instances/${instanceId}/status`);

                if (!statusData || statusData.status === 'error') {
                    throw new Error('Instância não encontrada ou com erro');
                }

                // Se a instância já estiver conectada, não precisa mostrar QR Code
                else if (statusData.status === 'connected') {
                    this.showNotification('Instância já conectada!', 'success');
                    return;
                }

                // Se estiver aguardando QR Code, tentar obtê-lo
               else   {
                    const qrData = await this._fetchJson(`/api/whatsapp/instances/${instanceId}/qrcode`);

                    if (qrData && qrData.qrCode) {
                        // Mostrar QR Code
                        this.showQRCode(instanceId, qrData.qrCode);
                        this.showNotification('QR Code disponível! Escaneie para conectar.', 'info');
                        return;
                    }
                }

                // Se chegou aqui e é a última tentativa, lançar erro
                if (attempt === maxAttempts) {
                    throw new Error('QR Code não disponível após várias tentativas');
                }

            } catch (error) {
                console.error(`Erro na tentativa ${attempt} de obter QR Code:`, error);

                // Se for a última tentativa, mostrar erro
                if (attempt === maxAttempts) {
                    this.showNotification(
                        'Não foi possível obter o QR Code. Verifique se o serviço está rodando ou tente novamente mais tarde.',
                        'error'
                    );
                    throw error;
                }
            }
        }
    }

    setupGlobalEventHandlers() {
        // Click fora do modal fecha (usando handler bound)
        window.addEventListener('click', this._bound.windowClick);

        // ESC -> fechar modais
        document.addEventListener('keydown', this._bound.keydown);
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Handlers internos ------------------------ */
    _handleDocumentClick(e) {
        // Delegation para botões de abrir modal, adicionar instância, etc.
        const addBtn = e.target.closest('[data-action="add-instance"]');
        if (addBtn) {
            e.preventDefault();
            this.openInstanceModal();
            return;
        }

        const closeBtn = e.target.closest('[data-action="close-modal"]');
        if (closeBtn) {
            const modal = closeBtn.closest('.modal');
            if (modal) modal.style.display = 'none';
            this.stopQRCodeCheck();
            return;
        }

        // Qualquer outro botão global que precise ser tratado pode ser adicionado aqui.
    }

    _handleInstanceListClick(e) {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const instanceId = button.dataset.id;

        switch (action) {
            case 'show-qrcode':
                this.showQRCode(instanceId);
                break;
            case 'load-groups':
                this.loadGroups(instanceId);
                break;
            case 'view-groups':
                this.viewGroups(instanceId);
                break;
            case 'disconnect':
                this.disconnectInstance(instanceId);
                break;
            case 'delete':
                this.deleteInstance(instanceId);
                break;
            case 'edit':
                // abrir modal de edição (precisa ter os dados carregados)
                const inst = this.getInstance(instanceId);
                this.openInstanceModal(inst || null);
                break;
            default:
                console.warn('Action não mapeada:', action);
        }
    }

    _handleWindowClick(e) {
        if (e.target.classList && e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            if (e.target.id === 'qrcodeModal') this.stopQRCodeCheck();
        }
    }

    _handleKeydown(e) {
        if (e.key === 'Escape') this.closeAllModals();
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Fetch helper (Abort + timeout) ----------- */
    async _fetchJson(url, opts = {}, timeout = this._defaultRequestTimeout) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        opts.signal = controller.signal;

        // Mesclar headers de auth (se existirem)
        const headers = Object.assign({}, opts.headers || {}, this.getAuthHeaders());
        opts.headers = headers;

        try {
            const res = await fetch(url, opts);
            clearTimeout(id);
            const text = await res.text();
            // tentar parse seguro
            try {
                const json = text ? JSON.parse(text) : {};
                return json;
            } catch (err) {
                throw new Error(`Resposta inválida do servidor: ${text.slice(0, 200)}`);
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                throw new Error('Requisição expirou (timeout)');
            }
            throw err;
        }
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Instâncias / Cache ----------------------- */
    async loadInstances(forceRefresh = false) {
        if (!this.auth) {
            console.error('Auth manager not available');
            this.emit('error', new Error('Auth manager not available'));
            return;
        }

        try {
            const now = Date.now();
            const cached = this.state.cache.instances;
            const last = this.state.cache.lastUpdated;

            const cacheValid = !forceRefresh &&
                Array.isArray(cached) &&
                cached.length > 0 &&
                last &&
                (now - last) < this.state.cache.cacheTimeout;

            if (cacheValid) {
                console.log('Using cached instances');
                this.state.instances = cached;
                this.renderInstances(cached);
                this.emit('instancesLoaded', cached);
                return;
            }

            this.showLoading();
            const data = await this._fetchJson('/api/whatsapp/instances', {
                method: 'GET'
            });

            if (data && data.success) {
                this.state.cache.instances = data.instances || [];
                this.state.cache.lastUpdated = Date.now();

                this.state.instances = data.instances || [];
                this.renderInstances(this.state.instances);
                this.emit('instancesLoaded', this.state.instances);
            } else {
                throw new Error(data && data.error ? data.error : 'Erro ao carregar instâncias');
            }
        } catch (error) {
            console.error('Error loading instances:', error);
            this.emit('error', error);
            this.showNotification(error.message || 'Erro desconhecido', 'error');
            this.renderInstances([]);
        } finally {
            this.hideLoading();
        }
        this.renderInstances(this.state.instances);
        this.updateAddInstanceButton();
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

        // Gerar HTML usando data-attributes (sem inline onclick)
        container.innerHTML = instances.map(instance => {
            const id = instance._id || '';
            const statusText = this.getStatusText(instance.status);
            const phone = instance.phoneNumber || 'Não conectado';

            // Ações condicionais
            const actions = [];

            if (instance.status === 'connecting') {
                actions.push(`<button class="btn btn-info" data-action="show-qrcode" data-id="${id}"><i class="fas fa-qrcode"></i> QR Code</button>`);
            }
            if (instance.status === 'connected') {
                actions.push(`<button class="btn btn-success" data-action="load-groups" data-id="${id}"><i class="fas fa-sync"></i> Carregar Grupos</button>`);
                actions.push(`<button class="btn btn-warning" data-action="view-groups" data-id="${id}"><i class="fas fa-users"></i> Ver Grupos</button>`);
                actions.push(`<button class="btn btn-secondary" data-action="disconnect" data-id="${id}"><i class="fas fa-power-off"></i> Desconectar</button>`);
            }

            actions.push(`<button class="btn btn-primary" data-action="edit" data-id="${id}"><i class="fas fa-edit"></i> Editar</button>`);
            actions.push(`<button class="btn btn-danger" data-action="delete" data-id="${id}"><i class="fas fa-trash"></i> Excluir</button>`);

            return `
                <div class="list-item" data-instance-id="${id}">
                    <div class="list-item-info">
                        <h4>${this._escapeHtml(instance.sessionName || '')}</h4>
                        <p>Status: <span class="status-badge status-${this._escapeHtml(instance.status || '')}">${this._escapeHtml(statusText)}</span></p>
                        <p>Número: ${this._escapeHtml(phone)}</p>
                        <small>Criado em: ${this.formatDate(instance.createdAt)}</small>
                    </div>
                    <div class="list-item-actions">
                        ${actions.join(' ')}
                    </div>
                </div>
            `;
        }).join('');

        this.emit('instancesRendered', instances);
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- CRUD Instância --------------------------- */


    async showQRCode(instanceId) {
        if (!this.auth) return;
        try {
            this.showLoading();
            const data = await this._fetchJson(`/api/whatsapp/instances/${instanceId}/qrcode`);

            if (data && data.success && data.qrCode) {
                this.openQRCodeModal(instanceId, data.qrCode);
                this.emit('qrcodeShown', { instanceId, qrCode: data.qrCode });
            } else {
                throw new Error(data && data.error ? data.error : 'QR Code não disponível');
            }
        } catch (error) {
            console.error('Erro ao buscar QR Code:', error);
            this.emit('error', error);

            // Mensagem mais amigável em possíveis casos de já conectado
            if (error.message && error.message.toLowerCase().includes('já estar conectada')) {
                this.showNotification('Instância já está conectada!', 'info');
                this.loadInstances(true);
            } else {
                this.showNotification(error.message || 'Erro ao obter QR Code', 'error');
            }
        } finally {
            this.hideLoading();
        }
    }

    openQRCodeModal(instanceId, qrCode) {
        const modal = document.getElementById('qrcodeModal');
        const qrImage = document.getElementById('qrcodeImage');

        if (!modal || !qrImage) {
            this.showNotification('Elementos do modal de QR Code não encontrados', 'error');
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
        if (modal) modal.style.display = 'none';
        this.stopQRCodeCheck();
        this.emit('modalClosed', { type: 'qrcode' });
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Polling QR Code (safe) ------------------- */
    startQRCodeCheck(instanceId) {
        this.stopQRCodeCheck(); // cleanup anterior

        this.state.qrCodeCheck.instanceId = instanceId;
        this.state.qrCodeCheck.attempts = 0;

        // Cria interval que usa _fetchJson com timeout (cada requisição aborta se demorar)
        this.state.qrCodeCheck.intervalId = setInterval(async () => {
            this.state.qrCodeCheck.attempts++;

            try {
                const data = await this._fetchJson(`/api/whatsapp/instances/${instanceId}`, {}, 8000);

                if (data && data.success && data.instance) {
                    const st = data.instance.status;
                    if (st === 'connected') {
                        this.showNotification('WhatsApp conectado com sucesso!', 'success');
                        this.closeQRCodeModal();

                        this.state.cache.instances = null;
                        this.state.cache.lastUpdated = null;

                        this.loadInstances(true);
                        this.emit('instanceConnected', data.instance);
                    } else if (st === 'failed') {
                        this.showNotification('Falha ao conectar WhatsApp', 'error');
                        this.closeQRCodeModal();
                        this.emit('connectionFailed', data.instance);
                    } // outros status: continuar
                }

                if (this.state.qrCodeCheck.attempts >= this.state.qrCodeCheck.maxAttempts) {
                    this.stopQRCodeCheck();
                    this.showNotification('Tempo esgotado para escanear QR Code', 'warning');
                    this.emit('qrcodeTimeout', { instanceId, attempts: this.state.qrCodeCheck.attempts });
                }
            } catch (err) {
                console.error('Erro ao verificar status:', err);
                this.emit('error', err);
                // não fechar automaticamente, apenas logar; poderia contar como tentativa
                if (this.state.qrCodeCheck.attempts >= this.state.qrCodeCheck.maxAttempts) {
                    this.stopQRCodeCheck();
                }
            }
        }, this.state.qrCodeCheck.delayMs);
    }

    stopQRCodeCheck() {
        if (this.state.qrCodeCheck.intervalId) {
            clearInterval(this.state.qrCodeCheck.intervalId);
            this.state.qrCodeCheck.intervalId = null;
        }
        this.state.qrCodeCheck.instanceId = null;
        this.state.qrCodeCheck.attempts = 0;
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Grupos / Visualização -------------------- */
    async loadGroups(instanceId) {
        if (!confirm('Deseja carregar os grupos do WhatsApp? Isso pode levar alguns segundos.') || !this.auth) return;

        try {
            this.showLoading();
            const data = await this._fetchJson(`/api/whatsapp/instances/${instanceId}/load-groups`, { method: 'POST' }, 20000);

            if (data && data.success) {
                this.showNotification(`${data.groupCount} grupos carregados com sucesso!`, 'success');
                this.emit('groupsLoaded', { instanceId, groupCount: data.groupCount });

                if (window.app && app.contactGroups) {
                    app.contactGroups.loadGroups();
                }
            } else {
                throw new Error(data && data.error ? data.error : 'Erro ao carregar grupos');
            }
        } catch (err) {
            console.error('Erro loadGroups:', err);
            this.emit('error', err);
            this.showNotification(err.message || 'Erro desconhecido', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async viewGroups(instanceId) {
        try {
            this.showLoading();
            const data = await this._fetchJson(`/api/whatsapp/instances/${instanceId}/groups`, {}, 10000);

            if (data && data.success) {
                this.showGroupsModal(data.groups);
                this.emit('groupsViewed', { instanceId, groups: data.groups });
            } else {
                throw new Error(data && data.error ? data.error : 'Erro ao carregar grupos');
            }
        } catch (err) {
            console.error('Erro viewGroups:', err);
            this.emit('error', err);
            this.showNotification(err.message || 'Erro desconhecido', 'error');
        } finally {
            this.hideLoading();
        }
    }

    showGroupsModal(groups) {
        const modal = document.getElementById('groupsModal');
        const container = document.getElementById('whatsappGroupsList');

        if (!modal || !container) {
            this.showNotification('Elementos do modal de grupos não encontrados', 'error');
            return;
        }

        if (!groups || groups.length === 0) {
            container.innerHTML = '<p>Nenhum grupo encontrado no WhatsApp.</p>';
        } else {
            container.innerHTML = groups.map(group => `
                <div class="group-item">
                    <h4>${this._escapeHtml(group.name || '')}</h4>
                    <p>${group.contactCount || 0} participantes</p>
                    <div class="group-participants">
                        ${group.contacts ? group.contacts.slice(0, 5).map(c => `<span class="participant">${this._escapeHtml(c.name || 'Sem nome')}</span>`).join('') : ''}
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
        if (modal) modal.style.display = 'none';
        this.emit('modalClosed', { type: 'groups' });
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Disconnect / Delete --------------------- */
    async disconnectInstance(instanceId) {
        if (!confirm('Tem certeza que deseja desconectar esta instância?') || !this.auth) return;

        try {
            this.showLoading();
            const data = await this._fetchJson(`/api/whatsapp/instances/${instanceId}/disconnect`, { method: 'PUT' }, 10000);

            if (data && data.success) {
                this.showNotification('Instância desconectada com sucesso!', 'success');
                this.state.cache.instances = null;
                this.state.cache.lastUpdated = null;
                await this.loadInstances(true);
                this.emit('instanceDisconnected', { instanceId });
            } else {
                throw new Error(data && data.error ? data.error : 'Erro ao desconectar instância');
            }
        } catch (err) {
            console.error('Erro disconnectInstance:', err);
            this.emit('error', err);
            this.showNotification(err.message || 'Erro desconhecido', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteInstance(instanceId) {
        if (!confirm('Tem certeza que deseja excluir esta instância? Isso irá remover todas as credenciais e você precisará escanear o QR code novamente.') || !this.auth) return;

        try {
            this.showLoading();

            // Buscar instância para obter sessionName (backend antigo exigia sessionName)
            const instanceData = await this._fetchJson(`/api/whatsapp/instances/${instanceId}`, {}, 10000);
            if (!instanceData || !instanceData.success || !instanceData.instance) {
                throw new Error(instanceData && instanceData.error ? instanceData.error : 'Erro ao buscar instância');
            }

            const sessionName = instanceData.instance.sessionName;

            // Preferência: se backend aceitar delete por _id, usar `instanceId`. 
            // Aqui usa sessionName por compatibilidade com seu código original.
            const response = await this._fetchJson(`/api/whatsapp/instances/${sessionName}`, { method: 'DELETE' }, 10000);

            if (response && response.success) {
                this.showNotification('Instância excluída com sucesso!', 'success');
                this.state.cache.instances = null;
                this.state.cache.lastUpdated = null;
                await this.loadInstances(true);
                this.emit('instanceDeleted', { instanceId, sessionName });
            } else {
                throw new Error(response && response.error ? response.error : 'Erro ao excluir instância');
            }
        } catch (err) {
            console.error('Erro deleteInstance:', err);
            this.emit('error', err);
            this.showNotification(err.message || 'Erro desconhecido', 'error');
        } finally {
            this.hideLoading();
        }
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Utilitários / UI ------------------------- */
    getInstance(instanceId) {
        return this.state.instances.find(inst => inst._id === instanceId);
    }

    getConnectedInstances() {
        return this.state.instances.filter(inst => inst.status === 'connected');
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
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleDateString('pt-BR');
        } catch (e) {
            return dateString;
        }
    }

    showNotification(message, type = 'info') {
        if (this.auth && typeof this.auth.showNotification === 'function') {
            this.auth.showNotification(message, type);
        } else if (typeof authInstance !== 'undefined' && authInstance.showNotification) {
            authInstance.showNotification(message, type);
        } else {
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

    openInstanceModal(instance = null) {
        this.state.currentInstance = instance;
        const modal = document.getElementById('instanceModal');
        const title = document.getElementById('instanceModalTitle');

        if (!modal || !title) {
            console.error('Modal elements not found');
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
        this.emit('modalOpened', { type: 'instance', instance });
    }

    closeInstanceModal() {
        const modal = document.getElementById('instanceModal');
        if (modal) modal.style.display = 'none';
        this.state.currentInstance = null;
        this.emit('modalClosed', { type: 'instance' });
    }

    populateInstanceForm(instance) {
        const nameInput = document.getElementById('instanceName');
        if (nameInput) nameInput.value = instance.sessionName || '';
    }

    clearInstanceForm() {
        const form = document.getElementById('instanceForm');
        if (form) form.reset();
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Cleanup / Destroy ----------------------- */
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        this.stopQRCodeCheck();
    }

    destroy() {
        this.stopQRCodeCheck();
        // remover event listeners adicionados com bind
        document.removeEventListener('click', this._bound.documentClick);
        document.removeEventListener('keydown', this._bound.keydown);
        window.removeEventListener('click', this._bound.windowClick);

        const instancesList = document.getElementById('instancesList');
        if (instancesList) instancesList.removeEventListener('click', this._bound.instanceListClick);

        this.eventHandlers = {};
    }
    /* ----------------------------------------------------------------- */

    /* ---------------------- Helpers pequenos ------------------------- */
    _escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    /* ----------------------------------------------------------------- */
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

// ===== PARTICIPANTS MANAGER CLASS =====
// ===== PARTICIPANTS MANAGER CLASS =====
class ParticipantsManager {
    constructor() {
        this.currentParticipant = null;
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;
        this.allParticipants = [];
        this.filteredParticipants = [];
    }

    init() {
        this.setupEventListeners();
        this.setupFilters();
    }

    setupEventListeners() {
        // Add participant button
        const addBtn = document.getElementById('addParticipantBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.openModal();
            });
        }

        // Sync button
        const syncBtn = document.getElementById('syncParticipantsBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                this.syncParticipants();
            });
        }

        // Search input
        const searchInput = document.getElementById('participantSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterParticipants(e.target.value);
            });
        }

        // Form submission
        const form = document.getElementById('participantForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveParticipant();
            });
        }

        // Modal close
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                if (e.target.closest('#participantModal')) {
                    this.closeModal();
                }
            });
        });
    }

    setupFilters() {
        // Instance filter
        const instanceFilter = document.getElementById('instanceFilter');
        if (instanceFilter) {
            this.loadInstancesForFilter();
            instanceFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Type filter
        const typeFilter = document.getElementById('participantTypeFilter');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }
    }

    async loadInstancesForFilter() {
        try {
            const response = await fetch('/api/whatsapp/instances', {
                headers: authInstance.getAuthHeaders()
            });
            const data = await response.json();

            if (data.success && data.instances) {
                const instanceFilter = document.getElementById('instanceFilter');
                if (instanceFilter) {
                    instanceFilter.innerHTML = '<option value="">Todas as instâncias</option>';

                    data.instances.forEach(instance => {
                        if (instance.status === 'connected') {
                            const option = document.createElement('option');
                            option.value = instance.sessionName;
                            option.textContent = `${instance.sessionName} (${instance.phoneNumber || 'N/A'})`;
                            instanceFilter.appendChild(option);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar instâncias para filtro:', error);
        }
    }

    async loadParticipants(page = 1) {
        try {
            if (!authInstance) {
                console.error('Auth instance not available');
                return;
            }

            authInstance.showLoading();

            const instanceFilter = document.getElementById('instanceFilter')?.value;
            const typeFilter = document.getElementById('participantTypeFilter')?.value;
            const search = document.getElementById('participantSearch')?.value;

            // Use URLSearchParams para agrupar todos os params (incluindo paginação)
            const params = new URLSearchParams();
            params.append('page', page);
            params.append('limit', this.pageSize);

            if (typeFilter) params.append('source', typeFilter);
            if (search) params.append('search', search);

            let url;
            if (instanceFilter && instanceFilter.trim() !== '') {
                // rota específica para filtro por instância
                url = '/api/participants/filter/instance';
                // instancia vai como param também
                params.append('instance', instanceFilter);
            } else {
                // rota geral
                url = '/api/participants';
            }

            const queryString = params.toString();
            if (queryString) {
                url += `?${queryString}`;
            }

            console.log('🔍 Loading participants from:', url);

            const response = await fetch(url, {
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.allParticipants = data.participants || [];

                // Atualizar paginação se disponível
                if (data.pagination) {
                    this.totalPages = data.pagination.totalPages || 1;
                    this.currentPage = data.pagination.currentPage || 1;
                } else {
                    this.totalPages = 1;
                    this.currentPage = page || 1;
                }

                this.renderParticipants(this.allParticipants);

                // Atualizar estatísticas
                if (data.statistics) {
                    this.updateStats(data.statistics);
                }

                this.updatePagination();
            } else {
                throw new Error(data.error || 'Erro ao carregar contatos');
            }
        } catch (error) {
            console.error('Erro ao carregar participantes:', error);
            if (authInstance) {
                authInstance.showNotification(error.message, 'error');
            }
            this.renderParticipants([]);
        } finally {
            if (authInstance) {
                authInstance.hideLoading();
            }
        }
    }


    renderParticipants(participants) {
        const container = document.getElementById('participantsList');
        if (!container) return;

        if (!participants || participants.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-address-book fa-3x"></i>
                    <h3>Nenhum contato encontrado</h3>
                    <p>Comece sincronizando seus contatos do WhatsApp ou adicionando manualmente</p>
                </div>
            `;
            return;
        }

        container.innerHTML = participants.map(participant => {
            // Extrair dados com fallbacks para diferentes estruturas
            const id = participant.id || participant._id;
            const name = participant.name || participant.pushName || 'Sem nome';
            const phone = participant.phone || participant.phoneNumber;
            const whatsappId = participant.whatsappId || participant.participantId;
            const source = participant.source || 'whatsapp';
            const groups = participant.groups || [];
            const messageCount = participant.messageCount || 0;
            const lastActivity = participant.lastActivity || participant.updatedAt;
            const isBusiness = participant.isBusiness || false;
            const isActive = participant.isActive !== undefined ? participant.isActive : true;

            return `
                <div class="list-item" data-id="${id}">
                    <div class="list-item-info">
                        <h4>${this.escapeHtml(name)}</h4>
                        <p>Telefone: ${this.formatPhone(phone)}</p>
                        <div class="participant-details">
                            <small>
                                <span class="badge ${source === 'whatsapp' ? 'badge-success' : 'badge-info'}">
                                    ${source === 'whatsapp' ? 'WhatsApp' : 'Manual'}
                                </span>
                                ${isBusiness ? '<span class="badge badge-warning">Business</span>' : ''}
                                ${!isActive ? '<span class="badge badge-secondary">Inativo</span>' : ''}
                                ${groups.length > 0 ? `<span class="badge badge-primary">${groups.length} grupos</span>` : ''}
                            </small>
                            <div style="margin-top: 5px;">
                                <small>Mensagens: ${messageCount} | Última atividade: ${this.formatDate(lastActivity)}</small>
                            </div>
                        </div>
                    </div>
                    <div class="list-item-actions">
                        ${groups.length > 0 ? `
                            <button class="btn btn-info" onclick="app.participants.viewGroups('${id}')">
                                <i class="fas fa-users"></i> Grupos
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="app.participants.editParticipant('${id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger" onclick="app.participants.deleteParticipant('${id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateStats(stats) {
        const totalElem = document.getElementById('totalParticipants');
        const whatsappElem = document.getElementById('whatsappParticipants');
        const manualElem = document.getElementById('manualParticipants');
        const lastSyncElem = document.getElementById('lastSync');

        if (totalElem) totalElem.textContent = stats.total || 0;
        if (whatsappElem) whatsappElem.textContent = stats.whatsapp || 0;
        if (manualElem) manualElem.textContent = stats.manual || 0;

        if (lastSyncElem) {
            lastSyncElem.textContent = stats.lastSync
                ? this.formatDate(stats.lastSync)
                : 'Nunca';
        }
    }

    updatePagination() {
        const oldPagination = document.getElementById('participantsPagination');
        if (oldPagination) oldPagination.remove();

        if (this.totalPages <= 1) return;

        const container = document.getElementById('participantsList');
        if (!container) return;

        const pagination = document.createElement('div');
        pagination.id = 'participantsPagination';
        pagination.className = 'pagination';

        let paginationHtml = `
            <button class="btn btn-sm ${this.currentPage === 1 ? 'disabled' : ''}" 
                    onclick="app.participants.loadPage(${this.currentPage - 1})"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span class="page-info">Página ${this.currentPage} de ${this.totalPages}</span>
            <button class="btn btn-sm ${this.currentPage === this.totalPages ? 'disabled' : ''}"
                    onclick="app.participants.loadPage(${this.currentPage + 1})"
                    ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                Próxima <i class="fas fa-chevron-right"></i>
            </button>
        `;

        pagination.innerHTML = paginationHtml;
        container.appendChild(pagination);
    }

    loadPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.loadParticipants(page);
    }

    filterParticipants(searchTerm) {
        if (!searchTerm) {
            this.renderParticipants(this.allParticipants);
            return;
        }

        const filtered = this.allParticipants.filter(participant => {
            const name = (participant.name || participant.pushName || '').toLowerCase();
            const phone = (participant.phone || participant.phoneNumber || '').toLowerCase();
            const search = searchTerm.toLowerCase();

            return name.includes(search) || phone.includes(search);
        });

        this.renderParticipants(filtered);
    }

    applyFilters() {
        this.loadParticipants(1);
    }

    openModal(participant = null) {
        this.currentParticipant = participant;
        const modal = document.getElementById('participantModal');
        const title = document.getElementById('participantModalTitle');

        if (!modal || !title) return;

        if (participant) {
            title.textContent = 'Editar Contato';
            this.populateForm(participant);
        } else {
            title.textContent = 'Novo Contato';
            this.clearForm();
        }

        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('participantModal');
        if (modal) modal.style.display = 'none';
        this.currentParticipant = null;
    }

    populateForm(participant) {
        const nameInput = document.getElementById('participantName');
        const phoneInput = document.getElementById('participantPhone');
        const sourceInput = document.getElementById('participantSource');
        const notesInput = document.getElementById('participantNotes');

        const name = participant.name || participant.pushName;
        const phone = participant.phone || participant.phoneNumber;
        const source = participant.source || 'manual';
        const notes = participant.notes || '';

        if (nameInput) nameInput.value = name || '';
        if (phoneInput) phoneInput.value = phone || '';
        if (sourceInput) sourceInput.value = source;
        if (notesInput) notesInput.value = notes;
    }

    clearForm() {
        const form = document.getElementById('participantForm');
        if (form) form.reset();
    }

    async saveParticipant() {
        const nameInput = document.getElementById('participantName');
        const phoneInput = document.getElementById('participantPhone');
        const sourceInput = document.getElementById('participantSource');
        const notesInput = document.getElementById('participantNotes');

        if (!nameInput || !phoneInput || !authInstance) return;

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const source = 'manual'
        // const source = sourceInput ? sourceInput.value : 'manual';
        const notes = notesInput ? notesInput.value.trim() : '';

        if (!name || !phone) {
            authInstance.showNotification('Nome e telefone são obrigatórios', 'warning');
            return;
        }

        // Validar formato do telefone
        if (!/^\+?[1-9]\d{10,14}$/.test(phone)) {
            authInstance.showNotification('Formato de telefone inválido. Use: +5511999999999 ou 5511999999999', 'warning');
            return;
        }

        try {
            authInstance.showLoading();

            const url = this.currentParticipant
                ? `/api/participants/${this.currentParticipant.id || this.currentParticipant._id}`
                : '/api/participants/manual';

            const method = this.currentParticipant ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: authInstance.getAuthHeaders(),
                body: JSON.stringify({
                    name: name,
                    pushName: name,
                    phoneNumber: phone,
                    phone: phone,
                    source: source,
                    notes: notes
                })
            });

            const data = await response.json();

            if (data.success) {
                authInstance.showNotification(
                    this.currentParticipant ? 'Contato atualizado com sucesso!' : 'Contato criado com sucesso!',
                    'success'
                );
                this.closeModal();
                this.loadParticipants(this.currentPage);
            } else {
                throw new Error(data.error || 'Erro ao salvar contato');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    async editParticipant(participantId) {
        try {
            if (!authInstance) return;

            authInstance.showLoading();

            // Tentar obter dados específicos do participante
            const response = await fetch(`/api/participants/${participantId}`, {
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.openModal(data.participant || data);
            } else {
                // Se não houver rota específica, buscar da lista
                const participant = this.allParticipants.find(p =>
                    (p.id === participantId) || (p._id === participantId)
                );

                if (participant) {
                    this.openModal(participant);
                } else {
                    throw new Error('Contato não encontrado');
                }
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    async deleteParticipant(participantId) {
        if (!confirm('Tem certeza que deseja excluir este contato?') || !authInstance) {
            return;
        }

        try {
            authInstance.showLoading();

            // Tentar usar a rota de delete se existir
            const response = await fetch(`/api/participants/${participantId}`, {
                method: 'DELETE',
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                authInstance.showNotification('Contato excluído com sucesso!', 'success');
                this.loadParticipants(this.currentPage);
            } else {
                // Se a rota não existir, remover localmente
                this.allParticipants = this.allParticipants.filter(p =>
                    (p.id !== participantId) && (p._id !== participantId)
                );
                this.renderParticipants(this.allParticipants);
                authInstance.showNotification('Contato removido localmente', 'info');
            }
        } catch (error) {
            console.error('Erro ao excluir participante:', error);
            authInstance.showNotification('Erro ao excluir contato', 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    async syncParticipants() {
        try {
            if (!authInstance) return;

            if (!confirm('Deseja sincronizar contatos do WhatsApp? Isso pode demorar alguns segundos.')) {
                return;
            }

            authInstance.showLoading();

            // Carregar instâncias conectadas
            const instancesResponse = await fetch('/api/whatsapp/instances', {
                headers: authInstance.getAuthHeaders()
            });

            const instancesData = await instancesResponse.json();

            if (!instancesData.success || !instancesData.instances) {
                throw new Error('Erro ao carregar instâncias');
            }

            const connectedInstances = instancesData.instances.filter(i => i.status === 'connected');

            if (connectedInstances.length === 0) {
                authInstance.showNotification('Nenhuma instância conectada disponível', 'warning');
                return;
            }

            // Para cada instância conectada, sincronizar
            for (const instance of connectedInstances) {
                try {
                    // Rota para sincronizar grupos do participante
                    const syncResponse = await fetch(`/api/participants/${instance._id}/groups/sync`, {
                        method: 'POST',
                        headers: authInstance.getAuthHeaders()
                    });

                    const syncData = await syncResponse.json();

                    if (syncData.success) {
                        authInstance.showNotification(
                            `Contatos da instância ${instance.sessionName} sincronizados`,
                            'success'
                        );
                    }
                } catch (error) {
                    console.error(`Erro ao sincronizar instância ${instance.sessionName}:`, error);
                }
            }

            // Recarregar a lista de participantes
            setTimeout(() => {
                this.loadParticipants(1);
            }, 1000);

        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    async viewGroups(participantId) {
        try {
            if (!authInstance) return;

            authInstance.showLoading();

            // Usar a rota específica para grupos do participante
            const response = await fetch(`/api/participants/${participantId}/groups`, {
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                const groups = data.groups || [];
                this.showGroupsModal(groups, participantId);
            } else {
                // Se a rota não existir, buscar grupos do participante localmente
                const participant = this.allParticipants.find(p =>
                    (p.id === participantId) || (p._id === participantId)
                );

                if (participant && participant.groups) {
                    this.showGroupsModal(participant.groups, participantId);
                } else {
                    throw new Error('Não foi possível carregar os grupos');
                }
            }
        } catch (error) {
            console.error('Erro ao carregar grupos:', error);
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    showGroupsModal(groups, participantId) {
        const modalHTML = `
            <div id="participantGroupsModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <span class="close">&times;</span>
                    <h3>Grupos do Contato</h3>
                    <div class="groups-list" style="max-height: 400px; overflow-y: auto;">
                        ${groups && groups.length > 0
                ? groups.map(group => `
                                <div class="group-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <strong>${this.escapeHtml(group.name || group.jid)}</strong>
                                            <p style="margin: 5px 0; color: #666; font-size: 14px;">
                                                ${group.role ? `<small>Função: ${group.role}</small>` : ''}
                                                ${group.participantCount ? `<small> | ${group.participantCount} participantes</small>` : ''}
                                            </p>
                                        </div>
                                        ${group.role === 'admin' ? '<span class="badge badge-warning">Admin</span>' : ''}
                                    </div>
                                </div>
                            `).join('')
                : '<p>Este contato não está em nenhum grupo</p>'
            }
                    </div>
                    <div class="modal-actions" style="margin-top: 20px; display: flex; justify-content: space-between;">
                        <button type="button" class="btn btn-primary" onclick="app.participants.syncParticipantGroups('${participantId}')">
                            <i class="fas fa-sync"></i> Sincronizar Grupos
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('participantGroupsModal').remove()">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('participantGroupsModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('participantGroupsModal');
        const closeBtn = modal.querySelector('.close');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.style.display = 'block';
    }

    async syncParticipantGroups(participantId) {
        try {
            if (!authInstance) return;

            authInstance.showLoading();

            const response = await fetch(`/api/participants/${participantId}/groups/sync`, {
                method: 'POST',
                headers: authInstance.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                authInstance.showNotification('Grupos sincronizados com sucesso!', 'success');

                // Fechar o modal atual
                const modal = document.getElementById('participantGroupsModal');
                if (modal) modal.remove();

                // Recarregar os grupos
                this.viewGroups(participantId);
            } else {
                throw new Error(data.error || 'Erro ao sincronizar grupos');
            }
        } catch (error) {
            authInstance.showNotification(error.message, 'error');
        } finally {
            authInstance.hideLoading();
        }
    }

    // Helper methods
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    formatPhone(phone) {
        if (!phone) return 'N/A';

        // Remover todos os não dígitos
        const cleaned = phone.replace(/\D/g, '');

        // Se começar com 55 (Brasil)
        if (cleaned.startsWith('55') && cleaned.length === 13) {
            const ddd = cleaned.slice(2, 4);
            const prefix = cleaned.slice(4, 9);
            const suffix = cleaned.slice(9);
            return `+55 (${ddd}) ${prefix}-${suffix}`;
        }

        // Formato internacional genérico
        if (cleaned.length >= 10) {
            return `+${cleaned}`;
        }

        return phone;
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                return 'Hoje ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } else if (diffDays === 1) {
                return 'Ontem ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } else if (diffDays < 7) {
                return `${diffDays} dias atrás`;
            } else {
                return date.toLocaleDateString('pt-BR');
            }
        } catch {
            return dateString;
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

        // Initialize ParticipantsManager
        this.participants = new ParticipantsManager();
        this.participants.init();
        console.log('ParticipantsManager initialized');

        // Initialize ContactGroups
        this.contactGroups = new ContactGroups();
        this.contactGroups.init();
        console.log('ContactGroups initialized');

        // Initialize WhatsAppManager
        if (this.auth) {
            this.whatsappManager = new WhatsAppManager(this.auth);
            this.whatsappManager.init();
            console.log('WhatsApp Manager initialized with auth dependency');
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
            case 'participantsSection':
                if (this.participants) {
                    console.log('Loading participants...');
                    this.participants.loadParticipants();
                    this.participants.loadInstancesForFilter();
                }
                break;
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
                    setTimeout(() => {
                        this.whatsappManager.updateAddInstanceButton();
                    }, 200);
                    setTimeout(() => {
                        this.whatsappManager.setupEventListeners();
                    }, 100);
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