require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const { getDatabase } = require('./database');
const { verifyAdmin } = require('./authMiddleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ===== ROTAS =====
const clientesAppRoutes = require('./routes/clientes_app');
const produtosRoutes = require('./routes/produtos');
const authRoutes = require('./routes/auth');
const vendasRoutes = require('./routes/vendas');
const pedidosRoutes = require('./routes/pedidos');
const fiadoRoutes = require('./routes/fiado');
const despesasRoutes = require('./routes/despesas');
const agendamentosRoutes = require('./routes/agendamentos');
const fornecedoresRoutes = require('./routes/fornecedores');
const configuracoesRoutes = require('./routes/configuracoes');
const chatRoutes = require('./routes/chat');

// --- Clientes (app do consumidor) ---
app.post('/api/clientes/cadastrar', clientesAppRoutes.cadastrar);
app.post('/api/clientes/login', clientesAppRoutes.login);
app.get('/api/clientes/perfil', clientesAppRoutes.getPerfil);
app.put('/api/clientes/alterar-senha', clientesAppRoutes.alterarSenha);
app.put('/api/clientes/atualizar-perfil', clientesAppRoutes.atualizarPerfil);
app.get('/api/clientes/historico-pedidos', clientesAppRoutes.getHistoricoPedidos);

// --- Produtos ---
app.get('/api/produtos', produtosRoutes.listarProdutos);
app.post('/api/produtos', verifyAdmin, produtosRoutes.criarProduto);
app.put('/api/produtos/:id', verifyAdmin, produtosRoutes.atualizarProduto);
app.delete('/api/produtos/:id', verifyAdmin, produtosRoutes.deletarProduto);

// --- Autenticação admin ---
app.post('/api/auth/login', authRoutes.loginAdmin);

// --- Rotas modulares ---
app.use('/api/vendas', vendasRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/fiado', fiadoRoutes);
app.use('/api/despesas', despesasRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/fornecedores', fornecedoresRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/chat', chatRoutes);

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== INICIALIZAÇÃO =====
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await getDatabase(); // Garante criação de tabelas e dados padrão antes de iniciar
    server.listen(PORT, () => {
      console.log(`🔥 Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar o servidor:', error.message);
    process.exit(1);
  }
}

start();
