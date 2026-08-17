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

const os = require('os');

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
const pixRoutes = require('./routes/pix');
const analyticsRoutes = require('./routes/analytics');

// --- Clientes (app do consumidor) ---
app.post('/api/clientes/cadastrar', clientesAppRoutes.cadastrar);
app.post('/api/clientes/login', clientesAppRoutes.login);
app.get('/api/clientes/perfil', clientesAppRoutes.getPerfil);
app.put('/api/clientes/alterar-senha', clientesAppRoutes.alterarSenha);
app.put('/api/clientes/atualizar-perfil', clientesAppRoutes.atualizarPerfil);
app.get('/api/clientes/historico-pedidos', clientesAppRoutes.getHistoricoPedidos);
app.get('/api/clientes/admin/listar', verifyAdmin, clientesAppRoutes.listarClientesAdmin);

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
app.use('/api/pix', pixRoutes);
app.use('/api/analytics', analyticsRoutes);

// ===== DETECÇÃO DE IP DA REDE LOCAL (Para QR Codes de mesa funcionarem em celulares) =====
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.get('/api/server-info', (req, res) => {
  const localIp = getLocalIpAddress();
  const port = process.env.PORT || 3000;
  const baseUrl = process.env.BASE_URL || `http://${localIp}:${port}`;
  res.json({ localIp, port, baseUrl });
});

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
    server.listen(PORT, '0.0.0.0', () => {
      const localIp = getLocalIpAddress();
      console.log(`🔥 Servidor rodando localmente em http://localhost:${PORT}`);
      console.log(`📱 Acesso na rede local para QR Codes: http://${localIp}:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar o servidor:', error.message);
    process.exit(1);
  }
}

start();
