const bcrypt = require('bcryptjs');
const { query, execute } = require('../database');
const { generateToken, SECRET } = require('../authMiddleware');
const jwt = require('jsonwebtoken');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

async function cadastrar(req, res) {
  const { nome, usuario, username, email, telefone, turma, senha, confirmarSenha, confirmaSenha, tipo } = req.body;
  const userClean = String(username || usuario || '').toLowerCase().trim();
  const emailClean = String(email || '').toLowerCase().trim();
  const telDigits = String(telefone || '').replace(/\D/g, '').trim();
  const tipoUser = (tipo === 'visitante' || tipo === 'administrador') ? tipo : 'cliente';
  const confirmVal = confirmarSenha || confirmaSenha;

  if (!nome || !userClean || !senha) {
    return res.status(400).json({ erro: 'Nome, usuário e senha são obrigatórios' });
  }

  // Validação de E-mail obrigatório e formato xxxxxxxxxxxxxx@yyyyyy.com
  if (!emailClean || !EMAIL_REGEX.test(emailClean)) {
    return res.status(400).json({ erro: 'E-mail inválido. Utilize o formato seu_email@dominio.com' });
  }

  // Validação do padrão de telefone / WhatsApp (10 ou 11 dígitos: DDD + número, ex: 11-99999-9999)
  if (tipoUser === 'cliente' && (!telDigits || telDigits.length < 10 || telDigits.length > 11)) {
    return res.status(400).json({ erro: 'Telefone inválido. Formato esperado com DDD (ex: 12-99999-9999)' });
  }

  // Formata telefone padronizado: xx-zzzzz-zzzz ou xx-zzzz-zzzz
  let telFormatado = null;
  if (telDigits) {
    const ddd = telDigits.slice(0, 2);
    if (telDigits.length === 11) {
      telFormatado = `${ddd}-${telDigits.slice(2, 7)}-${telDigits.slice(7)}`;
    } else {
      telFormatado = `${ddd}-${telDigits.slice(2, 6)}-${telDigits.slice(6)}`;
    }
  }

  if (confirmVal && confirmVal !== senha) {
    return res.status(400).json({ erro: 'A confirmação de senha não coincide com a senha digitada' });
  }
  if (senha.length < 6 || !/[0-9]/.test(senha) || !/[!@#$%^&*(),.?":{}|<>]/.test(senha)) {
    return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres, 1 número e 1 símbolo' });
  }

  try {
    // 1. Não permitir usuários com o mesmo nome de usuário
    const usuarioExistente = await query('SELECT id FROM usuarios WHERE LOWER(username) = ?', [userClean]);
    if (usuarioExistente.length > 0) return res.status(400).json({ erro: 'Este nome de usuário já está cadastrado' });

    // 2. Não permitir dois usuários com o mesmo e-mail
    const emailExistente = await query('SELECT id FROM usuarios WHERE LOWER(email) = ?', [emailClean]);
    if (emailExistente.length > 0) return res.status(400).json({ erro: 'Este e-mail já está sendo utilizado por outra conta' });

    // 3. Não permitir telefone duplicado
    if (telDigits) {
      const telefoneExistente = await query('SELECT id FROM usuarios WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, " ", ""), "-", ""), "(", ""), ")", "") = ?', [telDigits]);
      if (telefoneExistente.length > 0) return res.status(400).json({ erro: 'Este número de telefone já está cadastrado' });
    }

    const senha_hash = bcrypt.hashSync(senha, 10);
    const dataCadastro = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const cfgLimRows = await query("SELECT valor FROM configuracoes WHERE chave = 'limite_padrao_fiado'");
    const limitePadrao = (cfgLimRows && cfgLimRows.length > 0) ? parseFloat(cfgLimRows[0].valor || 0) : 0.00;

    await execute(
      'INSERT INTO usuarios (nome, username, email, telefone, turma, senha_hash, tipo, limiteCredito, saldoDevedor, dataCadastro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?)',
      [nome.trim(), userClean, emailClean, telFormatado, turma || '', senha_hash, tipoUser, limitePadrao, dataCadastro]
    );
    res.status(201).json({ sucesso: true, mensagem: 'Cadastro realizado com sucesso!' });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ erro: 'Erro interno ao realizar cadastro' });
  }
}

async function excluirConta(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Não autorizado' });
    const decoded = jwt.verify(token, SECRET);

    // Verificar se tem dívida pendente antes de excluir
    const [user] = await query('SELECT saldoDevedor FROM usuarios WHERE id = ?', [decoded.id]);
    if (user && parseFloat(user.saldoDevedor || 0) > 0) {
      return res.status(400).json({ erro: `Não é possível excluir a conta pois você possui um saldo devedor de R$ ${parseFloat(user.saldoDevedor).toFixed(2).replace('.', ',')}. Por favor, quite seu saldo na cantina antes.` });
    }

    await execute('DELETE FROM usuarios WHERE id = ?', [decoded.id]);
    res.json({ sucesso: true, mensagem: 'Conta excluída com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    res.status(500).json({ erro: 'Erro ao excluir conta' });
  }
}

async function recuperarSenha(req, res) {
  const { login: loginField, usuario, telefone, novaSenha, confirmarSenha, confirmaSenha } = req.body;
  const userIdent = String(usuario || loginField || '').toLowerCase().trim();
  const telIdent = String(telefone || '').replace(/\D/g, '').trim();
  const confirmVal = confirmarSenha || confirmaSenha;

  if (!userIdent && !telIdent) {
    return res.status(400).json({ erro: 'Informe seu usuário ou telefone cadastrado' });
  }
  if (!novaSenha) {
    return res.status(400).json({ erro: 'Digite a nova senha' });
  }
  if (confirmVal && confirmVal !== novaSenha) {
    return res.status(400).json({ erro: 'A confirmação de senha não coincide com a nova senha' });
  }
  if (novaSenha.length < 6 || !/[0-9]/.test(novaSenha) || !/[!@#$%^&*(),.?":{}|<>]/.test(novaSenha)) {
    return res.status(400).json({ erro: 'A nova senha deve ter mínimo 6 caracteres, 1 número e 1 símbolo (ex: @, #, !)' });
  }

  try {
    let users = [];
    if (userIdent && telIdent) {
      users = await query('SELECT id, nome, username, telefone FROM usuarios WHERE (LOWER(username) = ? OR REPLACE(REPLACE(REPLACE(REPLACE(telefone, " ", ""), "-", ""), "(", ""), ")", "") = ?) AND (REPLACE(REPLACE(REPLACE(REPLACE(telefone, " ", ""), "-", ""), "(", ""), ")", "") = ? OR LOWER(username) = ?)', [userIdent, telIdent, telIdent, userIdent]);
    } else if (userIdent) {
      users = await query('SELECT id, nome, username, telefone FROM usuarios WHERE LOWER(username) = ? OR REPLACE(REPLACE(REPLACE(REPLACE(telefone, " ", ""), "-", ""), "(", ""), ")", "") = ?', [userIdent, userIdent]);
    } else if (telIdent) {
      users = await query('SELECT id, nome, username, telefone FROM usuarios WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, " ", ""), "-", ""), "(", ""), ")", "") = ?', [telIdent]);
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ erro: 'Conta não encontrada com os dados informados. Verifique o usuário ou telefone.' });
    }

    const targetUser = users[0];
    const novaHash = bcrypt.hashSync(novaSenha, 10);
    await execute('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [novaHash, targetUser.id]);

    res.json({
      sucesso: true,
      mensagem: `Senha redefinida com sucesso para o usuário ${targetUser.username || targetUser.nome}! Agora você pode acessar sua conta.`
    });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    res.status(500).json({ erro: 'Erro interno ao redefinir senha' });
  }
}

async function login(req, res) {
  const { login: loginField, senha } = req.body;
  if (!loginField || !senha) return res.status(400).json({ erro: 'Usuário/telefone e senha são obrigatórios' });
  try {
    const users = await query('SELECT * FROM usuarios WHERE username = ? OR email = ? OR telefone = ?', [loginField, loginField, loginField]);
    if (users.length === 0) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const user = users[0];
    const senhaValida = bcrypt.compareSync(senha, user.senha_hash);
    if (!senhaValida) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const token = generateToken({ id: user.id, nome: user.nome, tipo: user.tipo || 'cliente' });
    const limiteCredito = user.limiteCredito !== null && user.limiteCredito !== undefined ? parseFloat(user.limiteCredito) : 0.00;
    const saldoDevedor = parseFloat(user.saldoDevedor || 0.00);
    const saldoDisponivel = Math.max(0, limiteCredito - saldoDevedor);

    res.json({
      token,
      id: user.id,
      nome: user.nome,
      usuario: user.username,
      username: user.username,
      email: user.email || '',
      telefone: user.telefone || '',
      turma: user.turma || '',
      foto: user.foto || '',
      tipo: user.tipo || 'cliente',
      pontosFidelidade: user.pontosFidelidade || 0,
      limiteCredito,
      saldoDevedor,
      saldoDisponivel
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

async function getPerfil(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
    const decoded = jwt.verify(token, SECRET);
    const users = await query('SELECT id, nome, username as usuario, username, email, telefone, turma, foto, tipo, pontosFidelidade, dataCadastro, totalPedidos, limiteCredito, saldoDevedor FROM usuarios WHERE id = ?', [decoded.id]);
    if (users.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
    const user = users[0];
    const limite = user.limiteCredito !== null && user.limiteCredito !== undefined ? parseFloat(user.limiteCredito) : 0.00;
    const saldo = parseFloat(user.saldoDevedor || 0.00);
    user.limiteCredito = limite;
    user.saldoDevedor = saldo;
    user.saldoDisponivel = Math.max(0, limite - saldo);
    res.json(user);
  } catch (error) {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

async function alterarSenha(req, res) {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias' });
  if (novaSenha.length < 6 || !/[0-9]/.test(novaSenha) || !/[!@#$%^&*(),.?":{}|<>]/.test(novaSenha)) {
    return res.status(400).json({ erro: 'Nova senha deve ter mínimo 6 caracteres, 1 número e 1 símbolo' });
  }
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    const users = await query('SELECT senha_hash FROM usuarios WHERE id = ?', [decoded.id]);
    if (users.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (!bcrypt.compareSync(senhaAtual, users[0].senha_hash)) return res.status(401).json({ erro: 'Senha atual incorreta' });
    const novaSenhaHash = bcrypt.hashSync(novaSenha, 10);
    await execute('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [novaSenhaHash, decoded.id]);
    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao alterar senha' });
  }
}

async function atualizarPerfil(req, res) {
  const { nome, email, telefone, turma, foto } = req.body;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    const updates = [];
    const params = [];
    if (nome) { updates.push('nome = ?'); params.push(nome); }
    if (email) {
      const emailClean = String(email).toLowerCase().trim();
      if (!EMAIL_REGEX.test(emailClean)) {
        return res.status(400).json({ erro: 'Formato de e-mail inválido' });
      }
      const [duplicado] = await query('SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?', [emailClean, decoded.id]);
      if (duplicado) return res.status(400).json({ erro: 'Este e-mail já está sendo utilizado por outra conta' });
      updates.push('email = ?');
      params.push(emailClean);
    }
    if (telefone) {
      const telDigits = String(telefone).replace(/\D/g, '');
      if (telDigits.length >= 10 && telDigits.length <= 11) {
        const ddd = telDigits.slice(0, 2);
        const formatado = telDigits.length === 11 ? `${ddd}-${telDigits.slice(2, 7)}-${telDigits.slice(7)}` : `${ddd}-${telDigits.slice(2, 6)}-${telDigits.slice(6)}`;
        updates.push('telefone = ?');
        params.push(formatado);
      }
    }
    if (turma !== undefined) { updates.push('turma = ?'); params.push(turma); }
    if (foto !== undefined) { updates.push('foto = ?'); params.push(foto); }
    if (updates.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });
    params.push(decoded.id);
    await execute(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ sucesso: true, mensagem: 'Perfil atualizado!' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar perfil' });
  }
}

async function getHistoricoPedidos(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
    const decoded = jwt.verify(token, SECRET);
    
    // Obter dados do usuário para garantir correspondência ampla de pedidos anteriores
    const userRows = await query('SELECT nome, telefone FROM usuarios WHERE id = ?', [decoded.id]);
    const usuario = userRows[0] || {};
    const nomeUsuario = usuario.nome || decoded.nome || '';
    const telUsuario = usuario.telefone || '';

    const pedidos = await query(`
      SELECT * FROM pedidos 
      WHERE clienteAppId = ? 
         OR (nomeCliente = ? AND ? != '')
         OR (observacao LIKE ? AND ? != '')
      ORDER BY id DESC LIMIT 50
    `, [decoded.id, nomeUsuario, nomeUsuario, `%${telUsuario}%`, telUsuario]);

    if (pedidos.length > 0) {
      const pIds = pedidos.map(p => p.id);
      const placeholders = pIds.map(() => '?').join(',');
      const todosItens = await query(`SELECT * FROM itens_pedido WHERE pedidoId IN (${placeholders})`, pIds);
      const itensPorPedido = {};
      for (const item of todosItens) {
        item.precoUnitario = parseFloat(item.precoUnitario);
        if (!itensPorPedido[item.pedidoId]) itensPorPedido[item.pedidoId] = [];
        itensPorPedido[item.pedidoId].push(item);
      }
      for (const pedido of pedidos) {
        pedido.total = parseFloat(pedido.total);
        pedido.subtotal = parseFloat(pedido.subtotal || pedido.total);
        pedido.desconto = parseFloat(pedido.desconto || 0);
        pedido.descontoPontos = parseFloat(pedido.descontoPontos || 0);
        pedido.pontosUsados = parseInt(pedido.pontosUsados || 0, 10);
        pedido.itens = itensPorPedido[pedido.id] || [];
      }
    }
    res.json(pedidos);
  } catch (error) {
    console.error('Erro ao buscar histórico de pedidos:', error);
    res.status(401).json({ erro: 'Erro ao buscar pedidos' });
  }
}

async function listarClientesAdmin(req, res) {
  try {
    const clientes = await query(`
      SELECT 
        u.id, u.nome, u.username as usuario, u.username, u.telefone, u.turma, u.foto, u.tipo, u.pontosFidelidade, u.limiteCredito, u.saldoDevedor, u.dataCadastro,
        COALESCE((SELECT COUNT(*) FROM pedidos p WHERE p.clienteAppId = u.id), 0) as totalPedidos,
        COALESCE((SELECT SUM(p.total) FROM pedidos p WHERE p.clienteAppId = u.id AND p.status = 'entregue'), 0.00) as totalGasto
      FROM usuarios u
      ORDER BY u.id DESC
    `);

    clientes.forEach(c => {
      c.totalGasto = parseFloat(c.totalGasto || 0);
      c.saldoDevedor = parseFloat(c.saldoDevedor || 0);
      c.limiteCredito = parseFloat(c.limiteCredito || 50.00);
      c.pontosFidelidade = parseInt(c.pontosFidelidade || 0, 10);
    });

    res.json(clientes);
  } catch (error) {
    console.error('Erro ao listar clientes para admin:', error);
    res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
}

async function getExtratoFidelidade(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
    const decoded = jwt.verify(token, SECRET);

    const users = await query('SELECT id, nome, username, pontosFidelidade, totalPedidos FROM usuarios WHERE id = ?', [decoded.id]);
    if (users.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const usuario = users[0];
    const historico = await query('SELECT id, pedidoId, pontos, tipo, descricao, data FROM historico_fidelidade WHERE clienteId = ? ORDER BY id DESC LIMIT 50', [decoded.id]);

    res.json({
      pontosFidelidade: parseInt(usuario.pontosFidelidade || 0, 10),
      totalPedidos: parseInt(usuario.totalPedidos || 0, 10),
      historico
    });
  } catch (error) {
    console.error('Erro ao buscar extrato de fidelidade:', error);
    res.status(500).json({ erro: 'Erro ao buscar extrato de fidelidade' });
  }
}

async function ajustarPontosAdmin(req, res) {
  const { clienteId, pontos, tipo, descricao } = req.body;
  const pts = parseInt(pontos, 10);
  if (!clienteId || isNaN(pts) || pts === 0) {
    return res.status(400).json({ erro: 'Cliente ID e quantidade de pontos válida são obrigatórios' });
  }

  try {
    const users = await query('SELECT id, nome, pontosFidelidade FROM usuarios WHERE id = ?', [clienteId]);
    if (users.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });

    const tipoFinal = tipo || (pts > 0 ? 'ganho' : 'resgate');
    const descFinal = descricao || (pts > 0 ? `Ajuste manual de bônus (+${pts} pts)` : `Ajuste manual de débito (${pts} pts)`);
    const dataAgora = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (pts > 0) {
      await execute('UPDATE usuarios SET pontosFidelidade = pontosFidelidade + ? WHERE id = ?', [pts, clienteId]);
    } else {
      await execute('UPDATE usuarios SET pontosFidelidade = GREATEST(0, pontosFidelidade - ?) WHERE id = ?', [Math.abs(pts), clienteId]);
    }

    await execute(
      'INSERT INTO historico_fidelidade (clienteId, pontos, tipo, descricao, data) VALUES (?, ?, ?, ?, ?)',
      [clienteId, pts, tipoFinal, descFinal, dataAgora]
    );

    const [updated] = await query('SELECT pontosFidelidade FROM usuarios WHERE id = ?', [clienteId]);
    const novosPontos = parseInt(updated.pontosFidelidade || 0, 10);

    const io = req.app.get('io');
    if (io) io.emit('fidelidade_atualizada', { clienteId: parseInt(clienteId, 10), pontos: novosPontos });

    res.json({
      sucesso: true,
      mensagem: 'Pontos atualizados com sucesso!',
      pontosFidelidade: novosPontos
    });
  } catch (error) {
    console.error('Erro ao ajustar pontos:', error);
    res.status(500).json({ erro: 'Erro ao ajustar pontos do cliente' });
  }
}

module.exports = {
  cadastrar,
  login,
  getPerfil,
  alterarSenha,
  atualizarPerfil,
  getHistoricoPedidos,
  listarClientesAdmin,
  recuperarSenha,
  getExtratoFidelidade,
  ajustarPontosAdmin,
  excluirConta
};
