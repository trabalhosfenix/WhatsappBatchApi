class Auth {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user'));
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Toggle between login and register
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegister();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
    }

    showRegister() {
        document.getElementById('loginForm').closest('.login-card').style.display = 'none';
        document.getElementById('registerCard').style.display = 'block';
    }

    showLogin() {
        document.getElementById('registerCard').style.display = 'none';
        document.getElementById('loginForm').closest('.login-card').style.display = 'block';
    }

    async login() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

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
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;

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
        document.getElementById('loginSection').classList.add('active');
        document.getElementById('dashboardSection').classList.remove('active');
        document.getElementById('logoutBtn').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('loginSection').classList.remove('active');
        document.getElementById('dashboardSection').classList.add('active');
        document.getElementById('logoutBtn').style.display = 'block';
        
        // Update user info
        document.getElementById('userName').textContent = this.user.name;
        document.getElementById('userEmail').textContent = this.user.email;
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Initialize auth
const auth = new Auth();