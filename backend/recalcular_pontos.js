const { getDatabase } = require('./database');

async function recalcularPontos() {
  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    const [clientes] = await conn.execute("SELECT id, nome, pontosFidelidade FROM usuarios WHERE tipo != 'administrador'");
    console.log(`Encontrados ${clientes.length} clientes para atualização de pontos.`);

    for (const c of clientes) {
      const [pRows] = await conn.execute(
        "SELECT COALESCE(SUM(total), 0) as totalGasto FROM pedidos WHERE clienteAppId = ? AND status = 'entregue'",
        [c.id]
      );
      const totalGasto = parseFloat(pRows[0].totalGasto || 0);

      // Regra: 10% do dinheiro gasto em pontos
      let novosPontos = Math.round(totalGasto * 0.10);
      if (totalGasto > 0 && novosPontos < 1) novosPontos = 1;

      console.log(`👤 ${c.nome} (ID ${c.id}): Total Gasto = R$ ${totalGasto.toFixed(2)} ➔ Pontos: ${novosPontos} pts (era ${c.pontosFidelidade} pts)`);

      await conn.execute(
        'UPDATE usuarios SET pontosFidelidade = ? WHERE id = ?',
        [novosPontos, c.id]
      );

      await conn.execute('DELETE FROM historico_fidelidade WHERE clienteId = ?', [c.id]);
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (novosPontos > 0) {
        await conn.execute(
          'INSERT INTO historico_fidelidade (clienteId, pontos, tipo, descricao, data) VALUES (?, ?, "ganho", ?, ?)',
          [c.id, novosPontos, `Saldo de Fidelidade (10% sobre R$ ${totalGasto.toFixed(2)} gastos)`, nowStr]
        );
      }
    }
    console.log('✅ Pontos de todos os clientes atualizados com sucesso para 10% do total gasto!');
  } catch (err) {
    console.error('Erro ao atualizar pontos:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

recalcularPontos();
