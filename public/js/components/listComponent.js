// ===== OPTIMIZED LIST COMPONENT =====
class ListComponent {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;
        this.data = [];
        this.renderCache = null;
    }

    setData(data) {
        this.data = SecurityManager.sanitizeObject(data);
        this.renderCache = null;
        this.render();
    }

    render() {
        if (!this.container) return;

        if (this.data.length === 0) {
            SecurityManager.safeRender(this.container, this.config.emptyState || `
                <div class="empty-state">
                    <i class="fas fa-inbox fa-3x"></i>
                    <h3>Nenhum item encontrado</h3>
                    <p>Comece criando seu primeiro item</p>
                </div>
            `);
            return;
        }

        // Use cache if available
        if (this.renderCache) {
            this.container.innerHTML = this.renderCache;
        } else {
            const html = this.data.map(item => this.config.renderItem(item)).join('');
            SecurityManager.safeRender(this.container, html);
            this.renderCache = html;
        }

        // Attach event listeners
        this.attachEventListeners();
    }

    attachEventListeners() {
        if (this.config.events) {
            Object.entries(this.config.events).forEach(([selector, handler]) => {
                this.container.querySelectorAll(selector).forEach(element => {
                    element.addEventListener('click', handler);
                });
            });
        }
    }

    updateItem(itemId, updates) {
        const index = this.data.findIndex(item => item._id === itemId);
        if (index !== -1) {
            this.data[index] = { ...this.data[index], ...updates };
            this.renderCache = null;
            this.render();
        }
    }
     ;
    addItem(item) {
        this.data.unshift(SecurityManager.sanitizeObject(item));
        this.renderCache = null;
        this.render();
    }

    removeItem(itemId) {
        this.data = this.data.filter(item => item._id !== itemId);
        this.renderCache = null;
        this.render();
    }
}