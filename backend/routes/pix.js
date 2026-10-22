const express = require('express');
const router = express.Router();
const { execute, query } = require('../database');

/**
 * Função utilitária para calcular CRC16-CCITT (Polinômio 0x1021)
 * Obrigatório no padrão oficial EMV do Banco Central do Brasil para PIX
 */
function calcularCrc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Monta o Payload PIX EMV oficial do Banco Central com checksum CRC16 correto
 */
function gerarPixEmv({ chavePix, nome, cidade, valor, txid }) {
  const vStr = parseFloat(valor).toFixed(2);
  const chave = chavePix.trim();
  const merchantName = (nome || 'DOUTOR PALADAR').substring(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const merchantCity = (cidade || 'SAO PAULO').substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const idRef = (txid || 'DP' + Date.now()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 25);

  const formatField = (id, val) => `${id}${String(val.length).padStart(2, '0')}${val}`;

  const payloadSemCrc = [
    formatField('00', '01'),                                                // Payload Format Indicator
    formatField('26', [                                                     // Merchant Account Information
      formatField('00', 'BR.GOV.BCB.PIX'),
      formatField('01', chave)
    ].join('')),
    formatField('52', '0000'),                                              // Merchant Category Code
    formatField('53', '986'),                                               // Transaction Currency (BRL)
    formatField('54', vStr),                                                // Transaction Amount
    formatField('58', 'BR'),                                                // Country Code
    formatField('59', merchantName),                                        // Merchant Name
    formatField('60', merchantCity),                                        // Merchant City
    formatField('62', formatField('05', idRef)),                            // Additional Data Field (txid)
    '6304'                                                                  // CRC16 ID + Length
  ].join('');

  const checksum = calcularCrc16(payloadSemCrc);
  return payloadSemCrc + checksum;
}

// POST /api/pix/criar-pagamento - Cria pagamento via API do PagBank (PagSeguro) com fallback inteligente
router.post('/criar-pagamento', async (req, res) => {
  try {
    const { pedidoId, valor, descricao, payerEmail, payerNome } = req.body;
    if (!pedidoId || !valor) {
      return res.status(400).json({ erro: 'ID do pedido e valor são obrigatórios' });
    }

    const valorFloat = parseFloat(valor);
    const pagbankToken = process.env.PAGBANK_TOKEN || process.env.PAGSEGURO_TOKEN;
    const isSandbox = process.env.PAGBANK_ENV === 'sandbox';
    const baseUrl = isSandbox ? 'https://sandbox.api.pagseguro.com' : 'https://api.pagseguro.com';

    // ── 1. Tentativa via API Oficial PagBank /orders (PIX) ──
    if (pagbankToken && pagbankToken.trim() !== '') {
      try {
        const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args)).catch(() => global.fetch(...args));
        
        // PagBank espera valor em centavos (inteiro)
        const valorCentavos = Math.round(valorFloat * 100);
        const expiraEmMinutos = 60; // 1 hora de validade
        const expDate = new Date(Date.now() + expiraEmMinutos * 60 * 1000).toISOString();

        const pagbankPayload = {
          reference_id: `PED-${pedidoId}-${Date.now()}`,
          customer: {
            name: (payerNome || 'Cliente Cantina').substring(0, 50),
            email: payerEmail || 'cliente@doutorpaladar.com.br',
            tax_id: '11144477735' // CPF default caso não preenchido pelo aluno
          },
          items: [
            {
              reference_id: String(pedidoId),
              name: descricao || `Pedido #${pedidoId} - Doutor Paladar`,
              quantity: 1,
              unit_amount: valorCentavos
            }
          ],
          qr_codes: [
            {
              amount: {
                value: valorCentavos
              },
              expiration_date: expDate
            }
          ]
        };

        const pbResponse = await fetch(`${baseUrl}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pagbankToken}`
          },
          body: JSON.stringify(pagbankPayload)
        });

        const pbData = await pbResponse.json();

        if (pbResponse.ok && pbData.qr_codes && pbData.qr_codes.length > 0) {
          const qrInfo = pbData.qr_codes[0];
          const copiaCola = qrInfo.text;
          const linkPng = qrInfo.links?.find(l => l.media === 'image/png')?.href;
          const qrCodeUrl = linkPng || `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(copiaCola)}`;

          return res.json({
            sucesso: true,
            origem: 'pagbank_api',
            orderId: pbData.id,
            pedidoId: parseInt(pedidoId),
            valor: valorFloat,
            pixCopiaECola: copiaCola,
            qrCodeUrl,
            status: 'pending'
          });
        } else {
          console.warn('⚠️ PagBank retornou resposta com status ou erro:', pbData);
        }
      } catch (pbErr) {
        console.error('❌ Falha ao comunicar com a API do PagBank:', pbErr.message);
      }
    }

    // ── 2. Fallback: Geração com Chave PIX e CRC16 Oficial Válido para Qualquer Banco ──
    const chavePix = process.env.PIX_CHAVE || 'cantina@doutorpaladar.com.br';
    const nomeTitular = process.env.PIX_BENEFICIARIO || 'DOUTOR PALADAR';
    const cidadeTitular = process.env.PIX_CIDADE || 'SAO PAULO';
    const txid = `DP${pedidoId}${Date.now().toString().slice(-6)}`;

    const pixCopiaECola = gerarPixEmv({
      chavePix,
      nome: nomeTitular,
      cidade: cidadeTitular,
      valor: valorFloat,
      txid
    });

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(pixCopiaECola)}`;

    res.json({
      sucesso: true,
      origem: 'pix_emv_oficial',
      txid,
      pedidoId: parseInt(pedidoId),
      valor: valorFloat,
      pixCopiaECola,
      qrCodeUrl,
      status: 'pending'
    });
  } catch (error) {
    console.error('Erro ao gerar pagamento PIX:', error);
    res.status(500).json({ erro: 'Erro ao gerar pagamento PIX' });
  }
});

// Mantém rota legado como alias para compatibilidade
router.post('/mercadopago/criar-pagamento', async (req, res, next) => {
  req.url = '/criar-pagamento';
  router.handle(req, res, next);
});

// POST /api/pix/gerar - Endpoint direto simplificado
router.post('/gerar', async (req, res, next) => {
  req.url = '/criar-pagamento';
  router.handle(req, res, next);
});

// POST /api/pix/webhook - Webhook oficial para notificações do PagBank (PagSeguro)
router.post('/webhook', async (req, res) => {
  try {
    console.log('🔔 Webhook PagBank recebido:', JSON.stringify(req.body));
    const { reference_id, id, charges } = req.body;

    let pedidoId = null;

    // PagBank envia reference_id no formato PED-<id>-<timestamp>
    if (reference_id && reference_id.startsWith('PED-')) {
      const partes = reference_id.split('-');
      if (partes[1]) pedidoId = parseInt(partes[1]);
    }

    // Verifica se alguma cobrança associada foi paga (PAID)
    let isPago = false;
    if (charges && Array.isArray(charges)) {
      isPago = charges.some(c => c.status === 'PAID');
    }

    if (pedidoId && (isPago || req.body.status === 'PAID')) {
      await execute('UPDATE pedidos SET status = "confirmado" WHERE id = ?', [pedidoId]);
      const io = req.app.get('io');
      if (io) {
        io.emit('status_pedido_atualizado', { id: pedidoId, status: 'confirmado' });
        io.emit('pix_aprovado', { pedidoId });
      }
      console.log(`✅ Pedido #${pedidoId} aprovado automaticamente via PagBank!`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Erro ao processar Webhook PagBank:', error);
    res.status(200).send('OK');
  }
});

// POST /api/pix/simular-pagamento - Simula recebimento de aprovação do PIX (para testes no balcão)
router.post('/simular-pagamento', async (req, res) => {
  const { pedidoId } = req.body;
  if (!pedidoId) return res.status(400).json({ erro: 'ID do pedido é obrigatório' });

  try {
    const [pedido] = await query('SELECT * FROM pedidos WHERE id = ?', [pedidoId]);
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

    await execute('UPDATE pedidos SET status = "confirmado" WHERE id = ?', [pedidoId]);

    const io = req.app.get('io');
    if (io) {
      io.emit('status_pedido_atualizado', { id: parseInt(pedidoId), status: 'confirmado' });
      io.emit('pix_aprovado', { pedidoId: parseInt(pedidoId) });
    }

    res.json({ sucesso: true, mensagem: 'Pagamento PIX confirmado com sucesso!' });
  } catch (error) {
    console.error('Erro na simulação do PIX:', error);
    res.status(500).json({ erro: 'Erro ao processar confirmação PIX' });
  }
});

module.exports = router;
