class ContactGroups {
    constructor() {
        this.currentGroup = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add group button
        document.getElementById('addGroupBtn').addEventListener('click', () => {
            this.openGroupModal();
        });

        // Group form submission
        document.getElementById('groupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGroup();
        });

        // Add contact button
        document.getElementById('addContactBtn').addEventListener('click', () => {
            this.addContactField();
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            this.closeGroupModal();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('groupModal');
            if (e.target === modal) {
                this.closeGroupModal();
            }
        });
    }

    async loadGroups() {
        try {
            auth.showLoading();
            const response = await fetch('/api/contact-groups', {
                headers: auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.renderGroups(data.contactGroups);
            } else {
                throw new Error(data.error || 'Erro ao carregar grupos');
            }
        } catch (error) {
            auth.showNotification(error.message, 'error');
        } finally {
            auth.hideLoading();
        }
    }

    renderGroups(groups) {
        const container = document.getElementById('groupsList');
        
        if (groups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users fa-3x"></i>
                    <h3>Nenhum grupo encontrado</h3>
                    <p>Comece criando seu primeiro grupo de contatos</p>
                </div>
            `;
            return;
        }

        container.innerHTML = groups.map(group => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${group.name}</h4>
                    <p>${group.description || 'Sem descrição'}</p>
                    <small>${group.contactCount} contatos</small>
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-secondary" onclick="contactGroups.editGroup('${group._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="contactGroups.deleteGroup('${group._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    openGroupModal(group = null) {
        this.currentGroup = group;
        const modal = document.getElementById('groupModal');
        const title = document.getElementById('modalTitle');
        
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
        document.getElementById('groupModal').style.display = 'none';
        this.currentGroup = null;
    }

    populateGroupForm(group) {
        document.getElementById('groupName').value = group.name;
        document.getElementById('groupDescription').value = group.description || '';
        
        const contactsContainer = document.getElementById('contactsContainer');
        contactsContainer.innerHTML = '';
        
        group.contacts.forEach(contact => {
            this.addContactField(contact.name, contact.phone);
        });
    }

    clearGroupForm() {
        document.getElementById('groupForm').reset();
        document.getElementById('contactsContainer').innerHTML = '';
        this.addContactField(); // Add one empty contact field
    }

    addContactField(name = '', phone = '') {
        const container = document.getElementById('contactsContainer');
        const contactId = Date.now();
        
        const contactHtml = `
            <div class="contact-item" data-id="${contactId}">
                <input type="text" placeholder="Nome" value="${name}" required>
                <input type="tel" placeholder="Telefone (com DDD)" value="${phone}" required>
                <button type="button" class="remove-contact" onclick="contactGroups.removeContactField('${contactId}')">
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
        const name = document.getElementById('groupName').value;
        const description = document.getElementById('groupDescription').value;
        
        // Collect contacts
        const contacts = [];
        const contactElements = document.querySelectorAll('.contact-item');
        
        contactElements.forEach(element => {
            const inputs = element.querySelectorAll('input');
            const name = inputs[0].value.trim();
            const phone = inputs[1].value.trim();
            
            if (name && phone) {
                contacts.push({ name, phone });
            }
        });

        if (contacts.length === 0) {
            auth.showNotification('Adicione pelo menos um contato', 'warning');
            return;
        }

        try {
            auth.showLoading();
            
            const url = this.currentGroup 
                ? `/api/contact-groups/${this.currentGroup._id}`
                : '/api/contact-groups';
                
            const method = this.currentGroup ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: auth.getAuthHeaders(),
                body: JSON.stringify({ name, description, contacts })
            });

            const data = await response.json();

            if (data.success) {
                auth.showNotification(
                    this.currentGroup ? 'Grupo atualizado com sucesso!' : 'Grupo criado com sucesso!', 
                    'success'
                );
                this.closeGroupModal();
                this.loadGroups();
            } else {
                throw new Error(data.error || 'Erro ao salvar grupo');
            }
        } catch (error) {
            auth.showNotification(error.message, 'error');
        } finally {
            auth.hideLoading();
        }
    }

    async editGroup(groupId) {
        try {
            auth.showLoading();
            const response = await fetch(`/api/contact-groups/${groupId}`, {
                headers: auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.openGroupModal(data.contactGroup);
            } else {
                throw new Error(data.error || 'Erro ao carregar grupo');
            }
        } catch (error) {
            auth.showNotification(error.message, 'error');
        } finally {
            auth.hideLoading();
        }
    }

    async deleteGroup(groupId) {
        if (!confirm('Tem certeza que deseja excluir este grupo?')) {
            return;
        }

        try {
            auth.showLoading();
            const response = await fetch(`/api/contact-groups/${groupId}`, {
                method: 'DELETE',
                headers: auth.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                auth.showNotification('Grupo excluído com sucesso!', 'success');
                this.loadGroups();
            } else {
                throw new Error(data.error || 'Erro ao excluir grupo');
            }
        } catch (error) {
            auth.showNotification(error.message, 'error');
        } finally {
            auth.hideLoading();
        }
    }
}

// Initialize contact groups
const contactGroups = new ContactGroups();