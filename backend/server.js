const express = require('express');
const cors = require('cors');
const { verifyToken } = require('./authMiddleware');
const { getDatabase, autoSave } = require('./database');

const authRoutes = require('./routes/auth');
const produtosRoutes = require('./routes/produtos');
const vendasRoutes = require('./routes/vendas');
const fiadoRoutes = require('./routes/fiado');
const despesasRoutes = require('./routes/despesas');

async function main() {
  // Inicializa o banco de dados antes de iniciar o servidor
  await getDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Middleware para salvar automaticamente após operações de escrita
  app.use('/api/produtos', autoSave);
  app.use('/api/vendas', autoSave);
  app.use('/api/fiado', autoSave);
  app.use('/api/despesas', autoSave);

  app.use('/api/auth', authRoutes);
  app.use('/api/produtos', verifyToken, produtosRoutes);
  app.use('/api/vendas', verifyToken, vendasRoutes);
  app.use('/api/fiado', verifyToken, fiadoRoutes);
  app.use('/api/despesas', verifyToken, despesasRoutes);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('🔥 Backend rodando na porta ${PORT}'));
}

main().catch(err => console.error(err));
