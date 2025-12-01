// ===== THEME MANAGER =====
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('app-theme') || 'whatsapp';
        this.themes = {
            'whatsapp': {
                name: 'WhatsApp Padrão',
                primary: '#25D366',
                secondary: '#128C7E',
                dark: '#075E54',
                light: '#DCF8C6',
                background: 'white',
                fontPrimary: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                fontHeading: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
            },
            'rosa-digital': {
                name: 'Rosa Digital - Envios',
                primary: '#C2185B',
                secondary: '#F8BBD0',
                dark: '#880E4F',
                light: '#FCE4EC',
                background: '#FAF8F9',
                fontPrimary: 'Lato, Source Sans Pro, sans-serif',
                fontHeading: 'Playfair Display, serif'
            }
        };
        
        this.init();
    }

    init() {
        this.applyTheme('rosa-digital');
        this.setupThemeSelector();
        this.loadFonts();
    }

    applyTheme(themeName) {
        const theme = this.themes[themeName];
        if (!theme) return;

        this.currentTheme = themeName;
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('app-theme', themeName);
        
        // Update CSS variables
        const root = document.documentElement;
        root.style.setProperty('--theme-primary', theme.primary);
        root.style.setProperty('--theme-secondary', theme.secondary);
        root.style.setProperty('--theme-dark', theme.dark);
        root.style.setProperty('--theme-light', theme.light);
        root.style.setProperty('--theme-background', theme.background);
        root.style.setProperty('--theme-font-primary', theme.fontPrimary);
        root.style.setProperty('--theme-font-heading', theme.fontHeading);

        // Notify state change
        if (window.stateManager) {
            stateManager.setState('theme', themeName);
        }
    }

    setupThemeSelector() {
        // Create theme selector if it doesn't exist
        if (!document.getElementById('themeSelector')) {
            const themeSelector = document.createElement('div');
            themeSelector.id = 'themeSelector';
            themeSelector.className = 'theme-selector';
            themeSelector.innerHTML = `
                <button class="theme-toggle" id="themeToggle">
                    <i class="fas fa-palette"></i>
                </button>
                <div class="theme-menu" id="themeMenu">
                    ${Object.entries(this.themes).map(([key, theme]) => `
                        <button class="theme-option" data-theme="${key}">
                            <span class="theme-preview ${key}"></span>
                            <span>${theme.name}</span>
                        </button>
                    `).join('')}
                </div>
            `;
            document.body.appendChild(themeSelector);

            // Add event listeners
            document.getElementById('themeToggle').addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('themeMenu').classList.toggle('active');
            });

            document.querySelectorAll('.theme-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const theme = e.currentTarget.dataset.theme;
                    this.applyTheme(theme);
                    document.getElementById('themeMenu').classList.remove('active');
                });
            });

            // Close menu when clicking outside
            document.addEventListener('click', () => {
                document.getElementById('themeMenu')?.classList.remove('active');
            });
        }
    }

    loadFonts() {
        // Load Google Fonts for Rosa Digital theme
        if (this.currentTheme === 'rosa-digital') {
            const link = document.createElement('link');
            link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Lato:wght@300;400;700&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
    }

    getCurrentTheme() {
        return this.themes[this.currentTheme];
    }
}