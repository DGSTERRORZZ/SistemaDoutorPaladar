const bcrypt = require('bcryptjs');
const { getDatabase } = require('./database');

async function seedSimulado() {
  console.log('🚀 Iniciando geração e sincronização de dados simulados completos para o Admin...');
  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    // 1. Remover Pastel de Carne do sistema
    await conn.execute("DELETE FROM produtos WHERE nome LIKE '%Pastel de Carne%'");
    console.log('🗑️ Pastel de Carne removido do banco de dados.');

    // 2. Garantir Admin padrão
    const [adminCheck] = await conn.execute("SELECT id FROM usuarios WHERE username = 'admin' OR tipo = 'administrador'");
    const adminHash = bcrypt.hashSync('admin123', 10);
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (adminCheck.length === 0) {
      await conn.execute(
        "INSERT INTO usuarios (nome, username, senha_hash, tipo, dataCadastro) VALUES ('Deyse Nayana', 'admin', ?, 'administrador', ?)",
        [adminHash, nowStr]
      );
      console.log('👤 Admin padrão criado.');
    }

    // 3. Inserir / Atualizar Fornecedores
    const fornecedoresPadrao = [
      ['Valmir dos Salgados Artesanais', '342.581.908-11', '(11) 98765-4321', 'valmir.salgados@email.com', 'Rua das Indústrias, 450 - Entrega toda terça e quinta'],
      ['Marcos Bebidas & Refrigerantes', '215.890.432-55', '(11) 98123-4567', 'marcos.bebidas@email.com', 'Centro de Distribuição Regional - Entrega semanal'],
      ['Dona Maria Hortifruti Central', '189.432.765-90', '(11) 97412-5896', 'dona.maria.horti@email.com', 'Mercado Municipal, Box 14 - Frutas frescas e legumes'],
      ['Carlos Ultragaz Gás P45', '098.765.432-10', '(11) 99887-1234', 'carlos.gas@email.com', 'Central de Abastecimento P45'],
      ['Seu João Polpas & Sucos Naturais', '456.123.789-22', '(11) 98123-9988', 'polpas.joao@email.com', 'Av. Brasil, 1200 - Sucos integrais'],
      ['Renata Descartáveis & Embalagens', '321.654.987-00', '(11) 97654-3210', 'renata.descartaveis@email.com', 'Galpão 3 - Copos, guardanapos e saquinhos']
    ];

    for (const [nome, cpf, tel, email, end] of fornecedoresPadrao) {
      const [fExist] = await conn.execute('SELECT id FROM fornecedores WHERE nome = ?', [nome]);
      if (fExist.length === 0) {
        await conn.execute(
          'INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
          [nome, cpf, tel, email, end]
        );
      } else {
        await conn.execute(
          'UPDATE fornecedores SET cnpj = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?',
          [cpf, tel, email, end, fExist[0].id]
        );
      }
    }
    console.log('🏭 Fornecedores configurados com CPF.');

    // 4. Inserir Clientes Simulados
    const defaultPassHash = bcrypt.hashSync('123456@a', 10);
    const clientesSimulados = [
      { nome: 'Gabriel Souza Lima', username: 'gabrielsouza', tel: '12991112233', turma: '3º Informática', foto: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', saldo: 24.50, limite: 80.00, pontos: 18, totalPed: 18 },
      { nome: 'Beatriz Santos Oliveira', username: 'biast', tel: '12992223344', turma: '2º Mecânica', foto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', saldo: 0.00, limite: 60.00, pontos: 4, totalPed: 12 },
      { nome: 'Lucas Ferreira Castro', username: 'lucasfc', tel: '12993334455', turma: '1º Eletro', foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', saldo: 15.00, limite: 50.00, pontos: 7, totalPed: 8 },
      { nome: 'Camila Lima Duarte', username: 'camilalima', tel: '12994445566', turma: 'Prof. Química', foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', saldo: 42.00, limite: 150.00, pontos: 24, totalPed: 27 },
      { nome: 'Rodrigo Alves Silva', username: 'rodrigoas', tel: '12995556677', turma: 'Coordenação Apoio', foto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', saldo: 0.00, limite: 120.00, pontos: 3, totalPed: 35 },
      { nome: 'Mariana Costa Ribeiro', username: 'marianac', tel: '12996667788', turma: '3º Alimentos', foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', saldo: 18.00, limite: 70.00, pontos: 7, totalPed: 11 },
      { nome: 'Felipe Augusto Mendes', username: 'felipem', tel: '12997778899', turma: '2º Edificações', foto: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', saldo: 0.00, limite: 50.00, pontos: 2, totalPed: 6 },
      { nome: 'Juliana Ribeiro Rocha', username: 'julianarr', tel: '12998889900', turma: 'Secretaria Acadêmica', foto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', saldo: 9.50, limite: 100.00, pontos: 5, totalPed: 22 }
    ];

    const clienteIds = {};
    for (const c of clientesSimulados) {
      const [uExist] = await conn.execute('SELECT id FROM usuarios WHERE username = ?', [c.username]);
      if (uExist.length > 0) {
        clienteIds[c.username] = uExist[0].id;
        await conn.execute(
          'UPDATE usuarios SET nome = ?, telefone = ?, turma = ?, foto = ?, saldoDevedor = ?, limiteCredito = ?, pontosFidelidade = ?, totalPedidos = ? WHERE id = ?',
          [c.nome, c.tel, c.turma, c.foto, c.saldo, c.limite, c.pontos, c.totalPed, uExist[0].id]
        );
      } else {
        const [res] = await conn.execute(
          'INSERT INTO usuarios (nome, username, telefone, turma, senha_hash, tipo, foto, totalPedidos, pontosFidelidade, limiteCredito, saldoDevedor, dataCadastro) VALUES (?, ?, ?, ?, ?, "cliente", ?, ?, ?, ?, ?, ?)',
          [c.nome, c.username, c.tel, c.turma, defaultPassHash, c.foto, c.totalPed, c.pontos, c.limite, c.saldo, nowStr]
        );
        clienteIds[c.username] = res.insertId;
      }
    }
    console.log('👥 Clientes e usuários cadastrados e sincronizados.');

    // 5. Obter Lista de Produtos ativos
    const [produtos] = await conn.execute('SELECT id, nome, preco, categoria FROM produtos WHERE ativo = 1');
    if (produtos.length === 0) {
      console.log('Nenhum produto cadastrado!');
      return;
    }

    // 6. Gerar Vendas Simuladas no PDV (Últimos 30 dias até hoje)
    const [vendasCount] = await conn.execute('SELECT COUNT(*) as total FROM vendas');
    if (vendasCount[0].total < 15) {
      const formasPgto = ['PIX', 'Cartão Débito', 'Cartão Crédito', 'Dinheiro', 'Fiado'];
      
      for (let i = 28; i >= 0; i--) {
        const numVendasDia = i === 0 ? 8 : (i <= 3 ? 5 : Math.floor(Math.random() * 4) + 2);
        
        for (let j = 0; j < numVendasDia; j++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const hour = 8 + Math.floor(Math.random() * 12);
          const minute = Math.floor(Math.random() * 60);
          d.setHours(hour, minute, 0);
          const dataVenda = d.toISOString().slice(0, 19).replace('T', ' ');

          // Escolher 1 a 4 produtos aleatórios
          const numItens = Math.floor(Math.random() * 3) + 1;
          let totalVenda = 0;
          const itens = [];
          
          for (let k = 0; k < numItens; k++) {
            const prod = produtos[Math.floor(Math.random() * produtos.length)];
            const qtd = Math.floor(Math.random() * 2) + 1;
            const preco = parseFloat(prod.preco);
            totalVenda += qtd * preco;
            itens.push({ produtoId: prod.id, nome: prod.nome, quantidade: qtd, precoUnitario: preco });
          }

          const forma = formasPgto[Math.floor(Math.random() * formasPgto.length)];

          const [vRes] = await conn.execute(
            'INSERT INTO vendas (total, formaPagamento, data) VALUES (?, ?, ?)',
            [totalVenda.toFixed(2), forma, dataVenda]
          );

          for (const item of itens) {
            await conn.execute(
              'INSERT INTO itens_venda (vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)',
              [vRes.insertId, item.produtoId, item.nome, item.quantidade, item.precoUnitario]
            );
          }
        }
      }
      console.log('💰 Histórico rico de vendas gerado com sucesso!');
    }

    // 7. Gerar Pedidos Simulados (com status variados para gestão em tempo real)
    const [pedidosCount] = await conn.execute('SELECT COUNT(*) as total FROM pedidos');
    if (pedidosCount[0].total < 10) {
      const statusList = ['pendente', 'confirmado', 'preparando', 'pronto', 'entregue', 'entregue', 'entregue', 'recusado'];
      const mesas = ['Mesa 02', 'Mesa 05', 'Mesa 08', 'Balcão', 'Retirada 12:30', 'Mesa 11', 'Sala dos Professores'];
      const horarios = ['10:15', '12:00', '12:30', '13:00', '15:45', '19:15', '20:45', '21:10'];

      const clientesArray = Object.keys(clienteIds);

      for (let i = 15; i >= 0; i--) {
        const numPeds = i === 0 ? 6 : (i === 1 ? 4 : 2);

        for (let p = 0; p < numPeds; p++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const hour = 9 + Math.floor(Math.random() * 11);
          d.setHours(hour, Math.floor(Math.random() * 59), 0);
          const dataPed = d.toISOString().slice(0, 19).replace('T', ' ');

          const cliKey = clientesArray[Math.floor(Math.random() * clientesArray.length)];
          const cliId = clienteIds[cliKey];
          const [uRow] = await conn.execute('SELECT nome, turma, telefone FROM usuarios WHERE id = ?', [cliId]);
          const u = uRow[0] || { nome: 'Cliente App', turma: 'IFSP', telefone: '12999999999' };

          // Status: se for hoje (i === 0), colocar alguns pendentes, preparando e prontos!
          let statusPed = 'entregue';
          if (i === 0) {
            const statusHoje = ['pendente', 'confirmado', 'preparando', 'pronto', 'entregue', 'pendente'];
            statusPed = statusHoje[p % statusHoje.length];
          } else if (i === 1) {
            statusPed = p === 0 ? 'recusado' : 'entregue';
          }

          const numItens = Math.floor(Math.random() * 3) + 1;
          let totalPed = 0;
          const itens = [];
          for (let k = 0; k < numItens; k++) {
            const prod = produtos[Math.floor(Math.random() * produtos.length)];
            const qtd = Math.floor(Math.random() * 2) + 1;
            const preco = parseFloat(prod.preco);
            totalPed += qtd * preco;
            itens.push({ produtoId: prod.id, nome: prod.nome, quantidade: qtd, precoUnitario: preco });
          }

          const mesa = mesas[Math.floor(Math.random() * mesas.length)];
          const horario = horarios[Math.floor(Math.random() * horarios.length)];
          const formaPgto = ['pix', 'dinheiro', 'cartao', 'fiado'][Math.floor(Math.random() * 4)];

          const [pRes] = await conn.execute(
            'INSERT INTO pedidos (clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [cliId, u.nome, u.turma, mesa, formaPgto, horario, totalPed.toFixed(2), statusPed, dataPed, `Pedido #${p + 1} - Contato: ${u.telefone}`]
          );

          for (const item of itens) {
            await conn.execute(
              'INSERT INTO itens_pedido (pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)',
              [pRes.insertId, item.produtoId, item.nome, item.quantidade, item.precoUnitario]
            );
          }

          // Inserir log de status
          await conn.execute(
            'INSERT INTO pedidos_status_log (pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (?, ?, ?, ?, ?)',
            [pRes.insertId, 'criado', statusPed, 'Sistema / Atendente', dataPed]
          );
        }
      }
      console.log('📦 Pedidos com fluxos e status diversificados gerados!');
    }

    // 8. Inserir Contas a Receber (Fiado) e Pagamentos
    const [dividasCount] = await conn.execute('SELECT COUNT(*) as total FROM dividas');
    if (dividasCount[0].total < 4) {
      // Inserir dívidas para Gabriel (24.50), Camila (42.00), Mariana (18.00), Juliana (9.50)
      const devedores = [
        { username: 'gabrielsouza', total: 24.50, pago: 0, valorPago: 0 },
        { username: 'camilalima', total: 72.00, pago: 0, valorPago: 30.00 },
        { username: 'marianac', total: 18.00, pago: 0, valorPago: 0 },
        { username: 'julianarr', total: 29.50, pago: 0, valorPago: 20.00 },
        { username: 'lucasfc', total: 35.00, pago: 1, valorPago: 35.00 } // quitado
      ];

      for (const dev of devedores) {
        const uId = clienteIds[dev.username];
        if (uId) {
          const dDate = new Date();
          dDate.setDate(dDate.getDate() - 3);
          const dDateStr = dDate.toISOString().slice(0, 19).replace('T', ' ');

          const [dRes] = await conn.execute(
            'INSERT INTO dividas (clienteId, data, total, valorPago, pago) VALUES (?, ?, ?, ?, ?)',
            [uId, dDateStr, dev.total, dev.valorPago, dev.pago]
          );

          // Itens da dívida
          const prod1 = produtos[0] || { id: 1, preco: 8.00 };
          const prod2 = produtos[1] || { id: 2, preco: 7.00 };
          await conn.execute(
            'INSERT INTO itens_divida (dividaId, produtoId, quantidade, precoUnitario) VALUES (?, ?, 2, ?), (?, ?, 1, ?)',
            [dRes.insertId, prod1.id, prod1.preco, dRes.insertId, prod2.id, prod2.preco]
          );

          // Histórico de pagamento se houver
          if (dev.valorPago > 0) {
            const payDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await conn.execute(
              'INSERT INTO pagamentos_fiado (clienteId, dividaId, valor, data) VALUES (?, ?, ?, ?)',
              [uId, dRes.insertId, dev.valorPago, payDate]
            );
          }
        }
      }
      console.log('💳 Dívidas, fiados e amortizações configurados.');
    }

    // 9. Inserir Despesas Simuladas do Mês
    const [despesasCount] = await conn.execute('SELECT COUNT(*) as total FROM despesas');
    if (despesasCount[0].total < 10) {
      const despesasExemplo = [
        ['Compra de queijo mussarela e presunto (20kg)', 480.00, 'Ingredientes', 2],
        ['Fardo de refrigerantes Coca-Cola e Sucos K-mais', 340.00, 'Bebidas', 3],
        ['Copos descartáveis, guardanapos e sacos kraft', 125.50, 'Embalagens', 5],
        ['Recarga de 2 botijões de Gás P13', 220.00, 'Gás', 7],
        ['Produtos de higienização e desinfecção ANVISA', 95.00, 'Limpeza', 8],
        ['Manutenção preventiva na estufa de salgados', 150.00, 'Manutenção', 10],
        ['Farinha de trigo especial, fermento e óleo (fardos)', 280.00, 'Ingredientes', 12],
        ['Conta de Energia Elétrica (CPFL)', 460.00, 'Energia', 15],
        ['Pagamento Ajudante de Cozinha - Quinzena', 850.00, 'Funcionários', 15],
        ['Polpas de açaí e cremosinho para reposição', 180.00, 'Bebidas', 18],
        ['Compra de carnes para recheio (Peito de frango e carne moída)', 390.00, 'Ingredientes', 20],
        ['Manutenção no freezer de sorvetes', 120.00, 'Manutenção', 24]
      ];

      for (const [desc, val, cat, diasAtras] of despesasExemplo) {
        const d = new Date();
        d.setDate(d.getDate() - diasAtras);
        const dataDesp = d.toISOString().slice(0, 19).replace('T', ' ');
        await conn.execute(
          'INSERT INTO despesas (descricao, valor, categoria, data) VALUES (?, ?, ?, ?)',
          [desc, val, cat, dataDesp]
        );
      }
      console.log('📋 Despesas operacionais cadastradas.');
    }

    // 10. Inserir Compras de Fornecedores
    const [comprasCount] = await conn.execute('SELECT COUNT(*) as total FROM compras_fornecedor');
    if (comprasCount[0].total < 4) {
      const [forns] = await conn.execute('SELECT id FROM fornecedores LIMIT 4');
      for (const f of forns) {
        const d = new Date();
        d.setDate(d.getDate() - Math.floor(Math.random() * 15 + 1));
        const dataCompra = d.toISOString().slice(0, 19).replace('T', ' ');
        const totalCompra = (Math.random() * 400 + 250).toFixed(2);

        const [cRes] = await conn.execute(
          'INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (?, ?, "entregue", ?)',
          [f.id, totalCompra, dataCompra]
        );

        const prod = produtos[0] || { id: 1, preco: 5.00 };
        await conn.execute(
          'INSERT INTO itens_compra (compraId, produtoId, quantidade, precoUnitario) VALUES (?, ?, 50, ?)',
          [cRes.insertId, prod.id, (prod.preco * 0.5).toFixed(2)]
        );
      }
      console.log('🚚 Pedidos de compras de fornecedores cadastrados.');
    }

    // 11. Inserir Agendamentos e Clientes Agendados
    const hojeStr = new Date().toISOString().slice(0, 10);
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toISOString().slice(0, 10);

    const agendamentosBase = [
      { data: hojeStr, horario: '12:00', prato: 'Almoço Executivo: Filé de Frango Grelhado, Arroz, Feijão e Salada', vagasTotais: 50, vagasOcupadas: 14, preco: 15.00 },
      { data: hojeStr, horario: '12:30', prato: 'Almoço Executivo: Filé de Frango Grelhado, Arroz, Feijão e Salada', vagasTotais: 50, vagasOcupadas: 22, preco: 15.00 },
      { data: hojeStr, horario: '13:00', prato: 'Almoço Executivo: Filé de Frango Grelhado, Arroz, Feijão e Salada', vagasTotais: 50, vagasOcupadas: 8, preco: 15.00 },
      { data: hojeStr, horario: '20:40', prato: 'Jantar Cantina: Caldo de Mandioquinha com Frango e Torradas', vagasTotais: 40, vagasOcupadas: 12, preco: 14.00 },
      { data: amanhaStr, horario: '12:00', prato: 'Feijoada Completa Light da Cantina', vagasTotais: 50, vagasOcupadas: 6, preco: 17.50 },
      { data: amanhaStr, horario: '12:30', prato: 'Feijoada Completa Light da Cantina', vagasTotais: 50, vagasOcupadas: 18, preco: 17.50 }
    ];

    for (const ag of agendamentosBase) {
      const [agExist] = await conn.execute('SELECT id FROM agendamentos WHERE data = ? AND horario = ?', [ag.data, ag.horario]);
      let agId = agExist[0]?.id;
      if (!agId) {
        const [res] = await conn.execute(
          'INSERT INTO agendamentos (data, horario, pratoDoDia, vagasTotais, vagasOcupadas, preco, bloqueado, dataCriacao) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
          [ag.data, ag.horario, ag.prato, ag.vagasTotais, ag.vagasOcupadas, ag.preco, nowStr]
        );
        agId = res.insertId;
      } else {
        await conn.execute(
          'UPDATE agendamentos SET pratoDoDia = ?, vagasTotais = ?, vagasOcupadas = ?, preco = ? WHERE id = ?',
          [ag.prato, ag.vagasTotais, ag.vagasOcupadas, ag.preco, agId]
        );
      }

      // Adicionar cliente_agendamentos para preencher a lista
      const [caExist] = await conn.execute('SELECT id FROM cliente_agendamentos WHERE agendamentoId = ?', [agId]);
      if (caExist.length === 0) {
        const nomes = [
          ['Gabriel Souza Lima', '12991112233', '3º Informática', 'agendado'],
          ['Camila Lima Duarte', '12994445566', 'Prof. Química', 'concluido'],
          ['Beatriz Santos Oliveira', '12992223344', '2º Mecânica', 'agendado']
        ];
        for (const [n, t, trm, st] of nomes) {
          await conn.execute(
            'INSERT INTO cliente_agendamentos (agendamentoId, nomeCliente, telefone, turma, status, dataCriacao) VALUES (?, ?, ?, ?, ?, ?)',
            [agId, n, t, trm, st, nowStr]
          );
        }
      }
    }
    console.log('📅 Agendamentos e reservas inseridos e sincronizados.');

    // 12. Histórico de Fidelidade
    const [fidCount] = await conn.execute('SELECT COUNT(*) as total FROM historico_fidelidade');
    if (fidCount[0].total < 5) {
      for (const [username, id] of Object.entries(clienteIds)) {
        await conn.execute(
          'INSERT INTO historico_fidelidade (clienteId, pontos, tipo, descricao, data) VALUES (?, 10, "ganho", "Pontos por pedido realizado no Cardápio", ?), (?, 20, "ganho", "Bônus de fidelidade da cantina", ?)',
          [id, nowStr, id, nowStr]
        );
      }
      console.log('🌟 Histórico de fidelidade populado.');
    }

    console.log('🎉 Todos os dados simulados foram gerados e interligados com sucesso no banco MySQL!');
  } catch (err) {
    console.error('❌ Erro ao rodar seed simulado:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  seedSimulado().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedSimulado };
