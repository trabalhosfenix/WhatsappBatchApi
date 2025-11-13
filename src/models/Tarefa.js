// models/Tarefa.js
const mongoose = require('mongoose');

const tarefaSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    titulo: {
        type: String,
        required: true,
        trim: true
    },
    descricao: {
        type: String,
        trim: true
    },
    tipo: {
        type: String,
        enum: ['lembrete', 'tarefa', 'evento'],
        default: 'tarefa'
    },
    dataHora: {
        type: Date,
        required: true
    },
    repetir: {
        type: String,
        enum: ['nenhuma', 'diariamente', 'semanalmente', 'mensalmente', 'anualmente'],
        default: 'nenhuma'
    },
    prioridade: {
        type: String,
        enum: ['baixa', 'media', 'alta', 'urgente'],
        default: 'media'
    },
    status: {
        type: String,
        enum: ['pendente', 'em_andamento', 'concluida', 'cancelada'],
        default: 'pendente'
    },
    categoria: {
        type: String,
        trim: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    notificarAntes: {
        type: Number, // minutos antes
        default: 15
    },
    popupMostrado: {
        type: Boolean,
        default: false
    },
    relacionadoAgenda: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agenda'
    }
}, {
    timestamps: true
});

// Indexes para performance
tarefaSchema.index({ userId: 1, dataHora: 1 });
tarefaSchema.index({ userId: 1, status: 1 });
tarefaSchema.index({ userId: 1, popupMostrado: 1 });

module.exports = mongoose.model('Tarefa', tarefaSchema);