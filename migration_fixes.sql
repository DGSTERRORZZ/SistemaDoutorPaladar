-- ============================================================
--  Doutor Paladar — Migration: Correções v2
--  Execute este script no MySQL ANTES de reiniciar o servidor
-- ============================================================

-- ── FIX 2: Renomear categoria 'Polpas' → 'Cremosinho' ────────
UPDATE produtos SET categoria = 'Cremosinho' WHERE categoria = 'Polpas';

-- ── FIX 1: Corrigir imagens dos produtos com imagens erradas ─
-- Salgados
UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'
  WHERE nome IN ('Risolis de Queijo', 'Risolis de Carne');

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1621852003960-b7aad6e0f07f?w=400&q=80'
  WHERE nome IN ('Esfiha de Carne', 'Kibe');

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80'
  WHERE nome IN ('Pão Batata Frango', 'Pão Batata Calabresa');

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80'
  WHERE nome IN ('Enroladinho Bauru', 'Enroladinho Salsicha');

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80'
  WHERE nome = 'Hambúrgão c/ Bacon';

-- Cremosinho / Polpas (agora com imagens reais)
UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&q=80'
  WHERE nome IN ('Polpa Abacaxi', 'Polpa Abacaxi c/ Hortelã');

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1559181567-c3190ca9be23?w=400&q=80'
  WHERE nome = 'Polpa Acerola';

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400&q=80'
  WHERE nome = 'Polpa Caju';

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1536511132770-e5058c7e8c46?w=400&q=80'
  WHERE nome = 'Polpa Goiaba';

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80'
  WHERE nome = 'Polpa Guaraná c/ Açaí';

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=400&q=80'
  WHERE nome IN ('Polpa Laranja', 'Polpa Laranja c/ Acerola');

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80'
  WHERE nome = 'Polpa Manga';

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1604495772376-9657f0035a54?w=400&q=80'
  WHERE nome = 'Polpa Maracujá';

UPDATE produtos SET imagem = 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80'
  WHERE nome = 'Polpa Uva';

-- ── Verificação final ────────────────────────────────────────
SELECT categoria, COUNT(*) AS qtd FROM produtos GROUP BY categoria ORDER BY categoria;
