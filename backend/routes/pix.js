const express = require('express');
const router = express.Router();
const { execute, query } = require('../database');

// POST /api/pix/gerar - Gera dados do QR Code PIX para o pedido
router.post('/gerar', async (req, res) => {
  try {
    const { pedidoId, valor } = req.body;
    const txid = 'DP' + Date.now();
    const pixCopiaECola = `00020126580014BR.GOV.BCB.PIX0136cantina@doutorpaladar.com.br5204000053039865405${parseFloat(valor).toFixed(2)}5802BR5920Doutor Paladar Cantina6009SAO PAULO62070503***63041D2E`;

    // Gerar QR Code via API pública confiável para o frontend exibir diretamente em <img>
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCopiaECola)}`;

    res.json({
      sucesso: true,
      txid,
      pedidoId,
      valor: parseFloat(valor),
      pixCopiaECola,
      qrCodeUrl
    });
  } catch (error) {
    console.error('Erro ao gerar PIX:', error);
    res.status(500).json({ erro: 'Erro ao gerar QR Code PIX' });
  }
});

// POST /api/pix/simular-pagamento - Simula recebimento de webhook de aprovação do PIX
router.post('/simular-pagamento', async (req, res) => {
  const { pedidoId } = req.body;
  if (!pedidoId) return res.status(400).json({ erro: 'ID do pedido é obrigatório' });

  try {
    const [pedido] = await query('SELECT * FROM pedidos WHERE id = ?', [pedidoId]);
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

    // Atualiza status do pedido para confirmado
    await execute('UPDATE pedidos SET status = "confirmado" WHERE id = ?', [pedidoId]);

    // Emite via Socket.io para que o frontend atualize instantaneamente sem reload
    const io = req.app.get('io');
    if (io) {
      io.emit('status_pedido_atualizado', { id: parseInt(pedidoId), status: 'confirmado' });
      io.emit('pix_aprovado', { pedidoId: parseInt(pedidoId) });
    }

    res.json({ sucesso: true, mensagem: 'Pagamento PIX confirmado com sucesso!' });
  } catch (error) {
    console.error('Erro no webhook PIX:', error);
    res.status(500).json({ erro: 'Erro ao processar confirmação PIX' });
  }
});

// POST /api/pix/webhook - Endpoint real para integrar com Mercado Pago ou EFI
router.post('/webhook', async (req, res) => {
  try {
    const { action, data } = req.body;
    console.log('🔔 Webhook PIX recebido:', req.body);
    // Responder 200 OK imediatamente para o gateway de pagamento
    res.status(200).send('OK');
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;
