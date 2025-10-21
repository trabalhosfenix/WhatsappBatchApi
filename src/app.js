// 📁 app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const mongoose = require('mongoose'); // ✅ ADICIONAR
const mediaBatchRoutes = require('./routes/mediaBatches');


// ✅ CORREÇÃO: Remover import do connectDB e conectar diretamente
// Conectar ao MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-batch-api';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => console.error('❌ Erro ao conectar MongoDB:', err));

// Importar rotas
const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const contactGroupRoutes = require('./routes/contactGroups');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();

// Middlewares de segurança
app.use(helmet({
  contentSecurityPolicy: false
}));


const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(o => o.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman / server requests

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn(`❌ CORS bloqueado: ${origin}`);
        return callback(null, true); // permite continuar, só loga
      }
    },
    credentials: true,
  })
);



app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Adicione na seção de rotas:
app.use('/api/media', mediaBatchRoutes);

// Servir arquivos de mídia estáticos (se necessário)
app.use('/media', express.static(path.join(__dirname, 'uploads/media')));


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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota para a interface web (se existir)
app.get('/', (req, res) => {
  res.json({ 
    message: 'WhatsApp Batch API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      batches: '/api/batches',
      contactGroups: '/api/contact-groups',
      whatsapp: '/api/whatsapp'
    }
  });
});

// Rota não encontrada
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Rota não encontrada' 
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Erro:', error.stack);
  res.status(500).json({ 
    success: false,
    error: 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

module.exports = app;