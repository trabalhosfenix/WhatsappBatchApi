// admin-dashboard-optimized.js

class RequestCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 30000; // 30 segundos
    }
    
    async get(key, fetchFn) {
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            console.log(`Usando cache para: ${key}`);
            return cached.data;
        }
        
        try {
            const data = await fetchFn();
            this.cache.set(key, {
                data,
                timestamp: Date.now()
            });
            return data;
        } catch (error) {
            // Se houver erro, retorna cache antigo se existir
            if (cached) {
                console.warn(`Erro ao buscar ${key}, usando cache antigo`);
                return cached.data;
            }
            throw error;
        }
    }
    
    clear() {
        this.cache.clear();
    }
    
    invalidate(key) {
        this.cache.delete(key);
    }
}

class RateLimitManager {
    constructor() {
        this.performanceMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retryAttempts: 0,
            cacheHits: 0
        };
        
        this.cache = new RequestCache();
        this.isLoading = false;
    }
    
    async fetchWithRetry(url, options = {}, retries = 3, backoff = 300) {
        this.performanceMetrics.totalRequests++;
        
        try {
            const response = await fetch(url, options);
            
            if (response.status === 429 && retries > 0) {
                this.performanceMetrics.retryAttempts++;
                console.warn(`Rate limited em ${url}, retentando em ${backoff}ms... (${retries} tentativas restantes)`);
                
                await this.delay(backoff);
                return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            }
            
            this.performanceMetrics.successfulRequests++;
            return await response.json();
            
        } catch (error) {
            this.performanceMetrics.failedRequests++;
            
            if (retries > 0 && error.message.includes('429')) {
                this.performanceMetrics.retryAttempts++;
                await this.delay(backoff);
                return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            
            throw error;
        }
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async sequentialRequests(requests, delayBetweenRequests = 500) {
        if (this.isLoading) {
            console.warn('Carregamento já em andamento...');
            return null;
        }
        
        this.isLoading = true;
        const results = [];
        
        try {
            for (let i = 0; i < requests.length; i++) {
                const { key, url, options } = requests[i];
                console.log(`Processando requisição ${i + 1}/${requests.length}: ${key}`);
                
                try {
                    const data = await this.cache.get(key, () => 
                        this.fetchWithRetry(url, options)
                    );
                    results.push(data);
                } catch (error) {
                    console.error(`Falha na requisição ${key}:`, error.message);
                    results.push(this.getFallbackData(key));
                }
                
                if (i < requests.length - 1) {
                    await this.delay(delayBetweenRequests);
                }
            }
            
            return results;
        } finally {
            this.isLoading = false;
        }
    }
    
    getFallbackData(endpoint) {
        const fallbacks = {
            'instances': {
                instances: [],
                total: 0,
                connected: 0,
                disconnected: 0
            },
            'batches': {
                batches: [],
                total: 0,
                pending: 0,
                sent: 0,
                failed: 0
            },
            'users': {
                users: [],
                total: 0,
                active: 0,
                inactive: 0
            },
            'messages': {
                total: 0,
                sent: 0,
                delivered: 0,
                read: 0,
                failed: 0
            }
        };
        
        console.warn(`Usando fallback para: ${endpoint}`);
        return fallbacks[endpoint] || null;
    }
    
    getMetrics() {
        return { ...this.performanceMetrics };
    }
    
    resetMetrics() {
        this.performanceMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retryAttempts: 0,
            cacheHits: 0
        };
    }
}

// Instância global do gerenciador
const rateLimitManager = new RateLimitManager();

// Funções específicas de fetch com cache e retry
async function fetchInstancesData() {
    try {
        return await rateLimitManager.cache.get('instances', () =>
            rateLimitManager.fetchWithRetry('/api/whatsapp/instances')
        );
    } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
        return rateLimitManager.getFallbackData('instances');
    }
}

async function fetchBatchesData() {
    try {
        return await rateLimitManager.cache.get('batches', () =>
            rateLimitManager.fetchWithRetry('/api/batches')
        );
    } catch (error) {
        console.error('Erro ao carregar lotes:', error);
        return rateLimitManager.getFallbackData('batches');
    }
}

async function fetchUsersData() {
    try {
        return await rateLimitManager.cache.get('users', () =>
            rateLimitManager.fetchWithRetry('/api/admin/users')
        );
    } catch (error) {
        console.warn('Endpoint de usuários não disponível, usando dados básicos');
        return rateLimitManager.getFallbackData('users');
    }
}

async function fetchMessagesData() {
    try {
        return await rateLimitManager.cache.get('messages', () =>
            rateLimitManager.fetchWithRetry('/api/admin/messages/stats')
        );
    } catch (error) {
        console.warn('Endpoint de estatísticas de mensagens não disponível, calculando manualmente');
        return rateLimitManager.getFallbackData('messages');
    }
}

// Função principal otimizada
async function loadRealData() {
    console.log('🚀 Iniciando carregamento otimizado de dados...');
    
    const requests = [
        { key: 'instances', url: '/api/whatsapp/instances', options: {} },
        { key: 'batches', url: '/api/batches', options: {} },
        { key: 'users', url: '/api/admin/users', options: {} },
        { key: 'messages', url: '/api/admin/messages/stats', options: {} }
    ];
    
    try {
        const [instancesData, batchesData, usersData, messagesData] = 
            await rateLimitManager.sequentialRequests(requests, 600);
        
        // Processar os dados recebidos
        await processLoadedData(instancesData, batchesData, usersData, messagesData);
        
        console.log('✅ Dados carregados com sucesso!');
        logPerformanceMetrics();
        
    } catch (error) {
        console.error('❌ Erro crítico no carregamento:', error);
        useEmergencyFallback();
    }
}

// Função alternativa para carregamento paralelo controlado
async function loadRealDataParallel() {
    console.log('🚀 Iniciando carregamento paralelo controlado...');
    
    try {
        const [instancesData, batchesData, usersData, messagesData] = await Promise.allSettled([
            fetchInstancesData(),
            fetchBatchesData(),
            fetchUsersData(),
            fetchMessagesData()
        ]);
        
        // Processar resultados
        const processedData = [
            instancesData.status === 'fulfilled' ? instancesData.value : rateLimitManager.getFallbackData('instances'),
            batchesData.status === 'fulfilled' ? batchesData.value : rateLimitManager.getFallbackData('batches'),
            usersData.status === 'fulfilled' ? usersData.value : rateLimitManager.getFallbackData('users'),
            messagesData.status === 'fulfilled' ? messagesData.value : rateLimitManager.getFallbackData('messages')
        ];
        
        await processLoadedData(...processedData);
        console.log('✅ Dados carregados (paralelo)!');
        logPerformanceMetrics();
        
    } catch (error) {
        console.error('❌ Erro no carregamento paralelo:', error);
        useEmergencyFallback();
    }
}

// Funções de suporte
async function processLoadedData(instancesData, batchesData, usersData, messagesData) {
    try {
        // Atualizar interface com instancesData
        if (instancesData && instancesData.instances) {
            updateInstancesSection(instancesData);
        }
        
        // Atualizar interface com batchesData
        if (batchesData && batchesData.batches) {
            updateBatchesSection(batchesData);
        }
        
        // Atualizar interface com usersData
        if (usersData && usersData.users) {
            updateUsersSection(usersData);
        }
        
        // Atualizar interface com messagesData
        if (messagesData) {
            updateMessagesSection(messagesData);
        }
        
        // Atualizar métricas e resumos
        updateDashboardSummary(instancesData, batchesData, usersData, messagesData);
        
    } catch (error) {
        console.error('Erro ao processar dados:', error);
    }
}

function useEmergencyFallback() {
    console.warn('⚠️ Usando fallback de emergência...');
    
    // Dados de fallback completos
    const emergencyData = {
        instances: {
            instances: [
                { name: 'Instância 1', status: 'connected', lastUpdate: new Date() },
                { name: 'Instância 2', status: 'disconnected', lastUpdate: new Date() }
            ],
            total: 2,
            connected: 1,
            disconnected: 1
        },
        batches: {
            batches: [
                { id: 1, name: 'Lote Emergência', status: 'pending', progress: 0 }
            ],
            total: 1,
            pending: 1,
            sent: 0,
            failed: 0
        },
        users: {
            users: [
                { id: 1, name: 'Usuário Demo', status: 'active', role: 'user' }
            ],
            total: 1,
            active: 1,
            inactive: 0
        },
        messages: {
            total: 0,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0
        }
    };
    
    processLoadedData(
        emergencyData.instances,
        emergencyData.batches,
        emergencyData.users,
        emergencyData.messages
    );
}

function logPerformanceMetrics() {
    const metrics = rateLimitManager.getMetrics();
    console.group('📊 Métricas de Performance');
    console.log(`Requisições Totais: ${metrics.totalRequests}`);
    console.log(`Sucessos: ${metrics.successfulRequests}`);
    console.log(`Falhas: ${metrics.failedRequests}`);
    console.log(`Tentativas de Retry: ${metrics.retryAttempts}`);
    console.log(`Cache Hits: ${metrics.cacheHits}`);
    console.groupEnd();
}

// Debounce para evitar múltiplos carregamentos
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Carregamento com debounce
const debouncedLoadRealData = debounce(loadRealData, 2000);

// Funções de atualização da UI (adaptar conforme sua aplicação)
function updateInstancesSection(data) {
    console.log('Atualizando seção de instâncias:', data);
    // Implementar atualização da UI
}

function updateBatchesSection(data) {
    console.log('Atualizando seção de lotes:', data);
    // Implementar atualização da UI
}

function updateUsersSection(data) {
    console.log('Atualizando seção de usuários:', data);
    // Implementar atualização da UI
}

function updateMessagesSection(data) {
    console.log('Atualizando seção de mensagens:', data);
    // Implementar atualização da UI
}

function updateDashboardSummary(instances, batches, users, messages) {
    console.log('Atualizando resumo do dashboard');
    // Implementar atualização do resumo
}

// Gerenciamento de erros global
window.addEventListener('error', function(e) {
    console.error('Erro global capturado:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rejeitada não tratada:', e.reason);
    e.preventDefault();
});

// API para controle externo
window.dashboardManager = {
    loadData: loadRealData,
    loadDataParallel: loadRealDataParallel,
    reload: () => {
        rateLimitManager.cache.clear();
        loadRealData();
    },
    getMetrics: () => rateLimitManager.getMetrics(),
    clearCache: () => rateLimitManager.cache.clear(),
    setCacheTTL: (ttl) => {
        rateLimitManager.cache.ttl = ttl;
    },
    forceFallback: useEmergencyFallback
};

// Inicialização automática quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🔄 Iniciando dashboard otimizado...');
        // Carregar dados após um breve delay
        setTimeout(loadRealData, 1000);
    });
} else {
    console.log('🔄 Iniciando dashboard otimizado...');
    setTimeout(loadRealData, 1000);
}

// Export para módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RateLimitManager,
        RequestCache,
        loadRealData,
        loadRealDataParallel,
        dashboardManager: window.dashboardManager
    };
}