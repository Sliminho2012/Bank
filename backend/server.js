server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Para permitir que o front-end se comunique com o back-end
require('dotenv').config(); // Carrega variáveis de ambiente (localmente)

const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI; 
const JWT_SECRET = process.env.JWT_SECRET || 'chave_super_secreta_default'; // Use uma forte no Render!

// Middlewares
app.use(cors({
    origin: '*', // Permite qualquer origem (para deploy estático)
    methods: ['GET', 'POST', 'PUT']
}));
app.use(express.json());

// Conexão com o MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Atlas conectado com sucesso!'))
    .catch(err => console.error('Erro de conexão com MongoDB:', err));

// --- Middlewares de Segurança ---

// Middleware para verificar o JWT e autenticar o usuário
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id; // Adiciona o ID do usuário à requisição
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
};

// --- ROTAS DA API ---

// 1. Rota de Criação de Conta
app.post('/api/create-account', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (await User.findOne({ username })) {
            return res.status(400).json({ message: 'Nome de usuário já existe.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'Conta criada com sucesso!', user: { username: newUser.username } });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar conta.', error: error.message });
    }
});

// 2. Rota de Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Usuário ou senha inválidos.' });
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Login realizado com sucesso!', token, username: user.username });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao tentar login.' });
    }
});

// 3. Rota para Obter Saldo e Nome de Usuário (Protegida)
app.get('/api/user/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('username balance');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.json({ username: user.username, balance: user.balance });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar dados do usuário.' });
    }
});


// A. ROTA DE PESQUISA DE USUÁRIOS
app.get('/api/users/search', authMiddleware, async (req, res) => {
    try {
        const { q } = req.query; // Pega o termo de pesquisa do URL (?q=termo)
        if (!q || q.length < 3) {
            return res.json([]); // Não retorna nada se a pesquisa for muito curta
        }

        // Busca usuários que contenham o termo, excluindo o próprio usuário logado
        const users = await User.find({
            username: { $regex: q, $options: 'i' }, // Busca insensível a maiúsculas/minúsculas
            _id: { $ne: req.userId } // Exclui o usuário atual
        }).select('username'); // Retorna apenas o nome de usuário

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Erro na pesquisa de usuários.' });
    }
});

// B. ROTA DE TRANSFERÊNCIA (O MAIS IMPORTANTE)
app.post('/api/transfer', authMiddleware, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction(); // Inicia uma transação atômica

    try {
        const { recipientUsername, amount } = req.body;
        const transferAmount = parseFloat(amount);

        if (isNaN(transferAmount) || transferAmount <= 0) {
            throw new Error('Valor de transferência inválido.');
        }

        // 1. Busca o remetente (usuário atual) e o destinatário
        const [sender, recipient] = await Promise.all([
            User.findById(req.userId).session(session),
            User.findOne({ username: recipientUsername }).session(session)
        ]);

        if (!sender) {
            throw new Error('Remetente não encontrado.');
        }
        if (!recipient) {
            throw new Error('Destinatário não encontrado.');
        }
        if (sender.balance < transferAmount) {
            throw new Error('Saldo insuficiente para a transferência.');
        }

        // 2. Executa a Transação (Débito e Crédito)
        sender.balance -= transferAmount;
        recipient.balance += transferAmount;

        // 3. Salva as mudanças
        await sender.save({ session });
        await recipient.save({ session });
        
        // 4. Se chegou até aqui, comita (confirma) a transação
        await session.commitTransaction();
        session.endSession();

        res.json({ 
            message: 'Transferência realizada com sucesso!', 
            newBalance: sender.balance 
        });

    } catch (error) {
        // Se houver qualquer erro, desfaz (rollback) a transação
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ message: error.message });
    }
});


// Rota base
app.get('/', (req, res) => {
    res.send('API Əternit está no ar!');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);

});
