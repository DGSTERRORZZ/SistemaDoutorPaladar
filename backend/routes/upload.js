const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyAdmin } = require('../authMiddleware');

// Pasta de destino para uploads estáticos: frontend/uploads/
const UPLOADS_DIR = path.join(__dirname, '../../frontend/uploads');

// Garante que o diretório exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// POST /api/upload - Recebe imagem em base64 ou multipart/form
router.post('/', async (req, res) => {
  try {
    const { imagemBase64, nomeArquivo, tipo } = req.body;

    if (!imagemBase64) {
      return res.status(400).json({ erro: 'Nenhum dado de imagem enviado (imagemBase64 é obrigatório)' });
    }

    // Extrai mime-type e dados base64 puro
    let matches = imagemBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let base64Data = '';
    let extensao = 'jpg';

    if (matches && matches.length === 3) {
      const mime = matches[1];
      base64Data = matches[2];
      if (mime.includes('png')) extensao = 'png';
      else if (mime.includes('webp')) extensao = 'webp';
      else if (mime.includes('gif')) extensao = 'gif';
      else if (mime.includes('svg')) extensao = 'svg';
      else extensao = 'jpg';
    } else {
      // Se enviado apenas base64 sem prefixo data:image
      base64Data = imagemBase64;
      extensao = tipo || 'jpg';
    }

    // Gerar nome único e limpo para o arquivo
    const prefixo = (nomeArquivo || 'produto').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30);
    const timestamp = Date.now();
    const fileName = `${prefixo}_${timestamp}.${extensao}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    // Escreve o buffer no disco
    const buffer = Buffer.from(base64Data, 'base64');

    // Validação de tamanho (máximo 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ erro: 'A imagem deve ter no máximo 5MB.' });
    }

    fs.writeFileSync(filePath, buffer);

    // Caminho estático servido pelo Express em frontend
    const urlPublica = `uploads/${fileName}`;

    res.json({
      sucesso: true,
      mensagem: 'Upload realizado com sucesso!',
      url: urlPublica,
      nomeArquivo: fileName,
      tamanhoBytes: buffer.length
    });
  } catch (error) {
    console.error('Erro ao salvar upload de imagem:', error);
    res.status(500).json({ erro: 'Erro interno ao processar upload da imagem.' });
  }
});

module.exports = router;
