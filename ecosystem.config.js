module.exports = {
  apps: [
    {
      name: "whatsapp-batch-api",
      script: "server.js",
      watch: false,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        MONGODB_URI: "mongodb://localhost:27017/whatsapp-batch-api",
        JWT_SECRET: "seu_jwt_secret_muito_seguro_aqui_altere_isso_com_no_minimo_32_caracteres",
        REDIS_URL: "redis://localhost:6379",
        CORS_ORIGIN: "http://localhost:3000",
        CLEANUP_INTERVAL_MS: 1800000,
        CLEANUP_START_DELAY_MS: 30000,
        INSTANCE_TIMEOUT_HOURS: 2,
        MAX_CLEANUP_TIME_MS: 300000
      }
    }
  ]
};


