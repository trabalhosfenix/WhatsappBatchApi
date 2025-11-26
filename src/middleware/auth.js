// 📁 middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token de acesso não fornecido' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Usuário não encontrado' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        error: 'Usuário desativado' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Erro de autenticação:', error);
    res.status(401).json({ 
      success: false,
      error: 'Token inválido' 
    });
  }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'Acesso negado. Apenas administradores.' 
        });
    }
    next();
};

// ✅ CORREÇÃO: Exportar como objeto
module.exports = { auth };