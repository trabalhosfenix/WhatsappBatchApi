const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./config/database');

// Importar rotas
const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const contactGroupRoutes = require('./routes/contactGroups');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();

// Conectar ao MongoDB
connectDB();

// Middlewares de segurança
app.use(helmet({
  contentSecurityPolicy: false // Simplificar para desenvolvimento
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Muitas requisições deste IP, tente novamente em 15 minutos.'
  }
});
app.use(limiter);

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/contact-groups', contactGroupRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Rota para a interface web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Rota não encontrada
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Erro:', error.stack);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

module.exports = app;