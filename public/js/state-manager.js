// ===== STATE MANAGER =====
class StateManager {
    constructor() {
        this.state = {
            user: null,
            theme: 'whatsapp',
            loading: false,
            notifications: [],
            cache: new Map(),
            pendingRequests: new Map()
        };
        this.listeners = new Map();
    }

    setState(key, value) {
        this.state[key] = value;
        this.notifyListeners(key, value);
    }

    getState(key) {
        return this.state[key];
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // Retornar função para unsubscribe
        return () => {
            this.listeners.get(key)?.delete(callback);
        };
    }

    notifyListeners(key, value) {
        this.listeners.get(key)?.forEach(callback => {
            try {
                callback(value, key);
            } catch (error) {
                console.error(`Error in state listener for ${key}:`, error);
            }
        });
    }

    // Cache management
    setCache(key, value, ttl = 300000) { // 5 minutes default
        this.state.cache.set(key, {
            value,
            expiry: Date.now() + ttl
        });
    }

    getCache(key) {
        const item = this.state.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.state.cache.delete(key);
            return null;
        }
        
        return item.value;
    }

    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.state.cache.keys()) {
                if (key.includes(pattern)) {
                    this.state.cache.delete(key);
                }
            }
        } else {
            this.state.cache.clear();
        }
    }
}

// Singleton instance
const stateManager = new StateManager();