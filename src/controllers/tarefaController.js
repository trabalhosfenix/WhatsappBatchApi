// controllers/tarefaController.js
const Tarefa = require('../models/Tarefa');

exports.criarTarefa = async (req, res) => {
    try {
        const {
            titulo,
            descricao,
            tipo,
            dataHora,
            repetir,
            prioridade,
            categoria,
            tags,
            notificarAntes,
            relacionadoAgenda
        } = req.body;

        const tarefa = await Tarefa.create({
            userId: req.user._id,
            titulo,
            descricao,
            tipo,
            dataHora: new Date(dataHora),
            repetir,
            prioridade,
            categoria,
            tags,
            notificarAntes,
            relacionadoAgenda
        });

        res.status(201).json({
            success: true,
            tarefa,
            message: 'Tarefa criada com sucesso!'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.criarTarefa = async (req, res) => {
    try {
        const {
            titulo,
            descricao,
            tipo,
            dataHora,
            repetir,
            prioridade,
            categoria,
            tags,
            notificarAntes,
            relacionadoAgenda
        } = req.body;

        // ✅ CORREÇÃO: Converter data/hora do formato local para Date object
        let dataHoraAjustada;
        if (dataHora) {
            // Se já vem como ISO string (com timezone), usar diretamente
            if (dataHora.includes('T') && dataHora.includes(':')) {
                dataHoraAjustada = new Date(dataHora);
            } else {
                // Se vem como string local, criar Date e ajustar timezone
                dataHoraAjustada = new Date(dataHora + 'Z'); // Adiciona Z para UTC
            }
            
            // ✅ VALIDAÇÃO: Verificar se a data é válida
            if (isNaN(dataHoraAjustada.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'Data/hora inválida'
                });
            }
        }

        console.log('📅 Data/Hora recebida:', {
            original: dataHora,
            ajustada: dataHoraAjustada,
            iso: dataHoraAjustada.toISOString(),
            local: dataHoraAjustada.toLocaleString('pt-BR')
        });

        const tarefa = await Tarefa.create({
            userId: req.user._id,
            titulo,
            descricao,
            tipo,
            dataHora: dataHoraAjustada, // ✅ Usar data ajustada
            repetir,
            prioridade,
            categoria,
            tags,
            notificarAntes,
            relacionadoAgenda
        });

        res.status(201).json({
            success: true,
            tarefa,
            message: 'Tarefa criada com sucesso!'
        });
    } catch (error) {
        console.error('❌ Erro ao criar tarefa:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.atualizarTarefa = async (req, res) => {
    try {
        const {
            titulo,
            descricao,
            tipo,
            dataHora,
            repetir,
            prioridade,
            categoria,
            tags,
            notificarAntes,
            status
        } = req.body;

        // ✅ CORREÇÃO: Aplicar mesma lógica de conversão de data no update
        let updateData = { ...req.body };
        
        if (dataHora) {
            let dataHoraAjustada;
            if (dataHora.includes('T') && dataHora.includes(':')) {
                dataHoraAjustada = new Date(dataHora);
            } else {
                dataHoraAjustada = new Date(dataHora + 'Z');
            }
            
            if (isNaN(dataHoraAjustada.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'Data/hora inválida'
                });
            }
            
            updateData.dataHora = dataHoraAjustada;
            
            console.log('📅 Data/Hora atualizada:', {
                original: dataHora,
                ajustada: dataHoraAjustada,
                iso: dataHoraAjustada.toISOString(),
                local: dataHoraAjustada.toLocaleString('pt-BR')
            });
        }

        const tarefa = await Tarefa.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updateData, // ✅ Usar dados atualizados com data corrigida
            { new: true, runValidators: true }
        );

        if (!tarefa) {
            return res.status(404).json({
                success: false,
                error: 'Tarefa não encontrada'
            });
        }

        res.json({
            success: true,
            tarefa,
            message: 'Tarefa atualizada com sucesso!'
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar tarefa:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.atualizarTarefa = async (req, res) => {
    try {
        const tarefa = await Tarefa.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!tarefa) {
            return res.status(404).json({
                success: false,
                error: 'Tarefa não encontrada'
            });
        }

        res.json({
            success: true,
            tarefa,
            message: 'Tarefa atualizada com sucesso!'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.listarTarefas = async (req, res) => {
    try {
        const { 
            tipo, 
            status, 
            prioridade, 
            categoria,
            dataInicio,
            dataFim,
            page = 1,
            limit = 20
        } = req.query;

        const filter = { userId: req.user._id };
        
        if (tipo) filter.tipo = tipo;
        if (status) filter.status = status;
        if (prioridade) filter.prioridade = prioridade;
        if (categoria) filter.categoria = categoria;
        
        if (dataInicio || dataFim) {
            filter.dataHora = {};
            if (dataInicio) filter.dataHora.$gte = new Date(dataInicio);
            if (dataFim) filter.dataHora.$lte = new Date(dataFim);
        }

        const tarefas = await Tarefa.find(filter)
            .sort({ dataHora: 1, prioridade: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Tarefa.countDocuments(filter);

        res.json({
            success: true,
            tarefas,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.obterTarefa = async (req, res) => {
    try {
        const tarefa = await Tarefa.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!tarefa) {
            return res.status(404).json({
                success: false,
                error: 'Tarefa não encontrada'
            });
        }

        res.json({
            success: true,
            tarefa
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.excluirTarefa = async (req, res) => {
    try {
        const tarefa = await Tarefa.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!tarefa) {
            return res.status(404).json({
                success: false,
                error: 'Tarefa não encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Tarefa excluída com sucesso!'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.tarefasPendentes = async (req, res) => {
    try {
        const tarefas = await Tarefa.find({
            userId: req.user._id,
            status: { $in: ['pendente', 'em_andamento'] }
        }).sort({ dataHora: 1 });

        res.json({
            success: true,
            tarefas,
            total: tarefas.length
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.proximasTarefas = async (req, res) => {
    try {
        const agora = new Date();
        const fimDia = new Date();
        fimDia.setHours(23, 59, 59, 999);

        const tarefas = await Tarefa.find({
            userId: req.user._id,
            dataHora: { $gte: agora, $lte: fimDia },
            status: { $in: ['pendente', 'em_andamento'] }
        }).sort({ dataHora: 1 }).limit(10);

        res.json({
            success: true,
            tarefas
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.tarefasHoje = async (req, res) => {
    try {
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);
        
        const fimDia = new Date();
        fimDia.setHours(23, 59, 59, 999);

        const tarefas = await Tarefa.find({
            userId: req.user._id,
            dataHora: { $gte: inicioDia, $lte: fimDia }
        }).sort({ dataHora: 1 });

        res.json({
            success: true,
            tarefas,
            total: tarefas.length
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.lembretesPendentes = async (req, res) => {
    try {
        const agora = new Date();
        const limite = new Date(agora.getTime() + 30 * 60 * 1000); // Próximos 30 minutos

        const lembretes = await Tarefa.find({
            userId: req.user._id,
            dataHora: { $lte: limite, $gte: agora },
            status: { $in: ['pendente', 'em_andamento'] },
            popupMostrado: false
        }).sort({ dataHora: 1 });

        res.json({
            success: true,
            lembretes,
            total: lembretes.length
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.marcarPopupMostrado = async (req, res) => {
    try {
        const tarefa = await Tarefa.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { popupMostrado: true },
            { new: true }
        );

        if (!tarefa) {
            return res.status(404).json({
                success: false,
                error: 'Tarefa não encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Popup marcado como mostrado'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.atualizarStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        const tarefa = await Tarefa.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { status },
            { new: true }
        );

        if (!tarefa) {
            return res.status(404).json({
                success: false,
                error: 'Tarefa não encontrada'
            });
        }

        res.json({
            success: true,
            tarefa,
            message: `Status atualizado para ${status}`
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};