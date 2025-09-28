// Main application controller
class App {
    constructor() {
        this.currentSection = 'contactGroupsSection';
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupSectionLoading();
    }

    setupNavigation() {
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-section');
                this.showSection(section);
            });
        });
    }

    setupSectionLoading() {
        // Load data when section becomes active
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
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

        // Show section
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        document.getElementById(sectionId).classList.add('active');
        
        this.currentSection = sectionId;
    }

    loadSectionData(sectionId) {
        switch (sectionId) {
            case 'contactGroupsSection':
                contactGroups.loadGroups();
                break;
            case 'whatsappSection':
                // whatsapp.loadInstances(); // To be implemented
                break;
            case 'batchesSection':
                // batches.loadBatches(); // To be implemented
                break;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

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