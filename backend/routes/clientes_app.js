const bcrypt = require('bcryptjs');
const { query, execute } = require('../database');
const { generateToken, SECRET } = require('../authMiddleware');
const jwt = require('jsonwebtoken');

async function cadastrar(req, res) {
  const { nome, usuario, username, telefone, turma, senha, tipo } = req.body;
  const userClean = String(username || usuario || '').toLowerCase().trim();
  const telClean = String(telefone || '').replace(/\D/g, '').trim();
  const tipoUser = (tipo === 'visitante' || tipo === 'administrador') ? tipo : 'cliente';

  if (!nome || !userClean || !senha) {
    return res.status(400).json({ erro: 'Nome, usuário e senha são obrigatórios' });
  }
  if (tipoUser === 'cliente' && !telClean) {
    return res.status(400).json({ erro: 'Telefone é obrigatório para cadastro de clientes' });
  }
  if (senha.length < 6 || !/[0-9]/.test(senha) || !/[!@#$%^&*(),.?":{}|<>]/.test(senha)) {
    return res.status(400).json({ erro: 'Senha deve ter mínimo 6 caracteres, 1 número e 1 símbolo' });
  }
  try {
    const usuarioExistente = await query('SELECT id FROM usuarios WHERE LOWER(username) = ?', [userClean]);
    if (usuarioExistente.length > 0) return res.status(400).json({ erro: 'Nome de usuário já cadastrado' });

    if (telClean) {
      const telefoneExistente = await query('SELECT id FROM usuarios WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, " ", ""), "-", ""), "(", ""), ")", "") = ? OR telefone = ?', [telClean, telClean]);
      if (telefoneExistente.length > 0) return res.status(400).json({ erro: 'Telefone já cadastrado' });
    }

    const senha_hash = bcrypt.hashSync(senha, 10);
    const dataCadastro = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await execute(
      'INSERT INTO usuarios (nome, username, telefone, turma, senha_hash, tipo, dataCadastro) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nome.trim(), userClean, telClean || null, turma || '', senha_hash, tipoUser, dataCadastro]
    );
    res.status(201).json({ sucesso: true, mensagem: 'Cadastro realizado com sucesso!' });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

async function login(req, res) {
  const { login: loginField, senha } = req.body;
  if (!loginField || !senha) return res.status(400).json({ erro: 'Usuário/telefone e senha são obrigatórios' });
  try {
    const users = await query('SELECT * FROM usuarios WHERE username = ? OR telefone = ?', [loginField, loginField]);
    if (users.length === 0) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const user = users[0];
    const senhaValida = bcrypt.compareSync(senha, user.senha_hash);
    if (!senhaValida) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const token = generateToken({ id: user.id, nome: user.nome, tipo: user.tipo || 'cliente' });
    res.json({
      token,
      id: user.id,
      nome: user.nome,
      usuario: user.username,
      username: user.username,
      telefone: user.telefone || '',
      turma: user.turma || '',
      foto: user.foto || '',
      tipo: user.tipo || 'cliente',
      pontosFidelidade: user.pontosFidelidade || 0
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
    const users = await query('SELECT id, nome, username as usuario, username, telefone, turma, foto, tipo, pontosFidelidade, dataCadastro, totalPedidos, limiteCredito, saldoDevedor FROM usuarios WHERE id = ?', [decoded.id]);
    if (users.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(users[0]);
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
  const { nome, telefone, turma, foto } = req.body;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    const updates = [];
    const params = [];
    if (nome) { updates.push('nome = ?'); params.push(nome); }
    if (telefone) { updates.push('telefone = ?'); params.push(telefone); }
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

    for (const pedido of pedidos) {
      pedido.itens = await query('SELECT * FROM itens_pedido WHERE pedidoId = ?', [pedido.id]);
      pedido.total = parseFloat(pedido.total);
      pedido.itens.forEach(item => { item.precoUnitario = parseFloat(item.precoUnitario); });
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

module.exports = { cadastrar, login, getPerfil, alterarSenha, atualizarPerfil, getHistoricoPedidos, listarClientesAdmin };
