// Script independente para criar e popular o banco de dados
// Uso: node seed.js
require('dotenv').config();
const { getDatabase } = require('./database');

(async () => {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');
    await getDatabase();
    const { seedSimulado } = require('./seed_admin_simulado');
    await seedSimulado();
    console.log('✅ Seed concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar seed:', error.message);
    process.exit(1);
  }
})();
