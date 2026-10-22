// =========================================================
// EXPORT.JS - Utilidade para Exportação (CSV/Excel) e Impressão PDF
// =========================================================

function exportarParaCSV(filename, rows) {
    if (!rows || !rows.length) {
        alert('Nenhum dado disponível para exportar.');
        return;
    }
    const separator = ';';
    const keys = Object.keys(rows[0]);
    const csvContent =
        '\uFEFF' + // UTF-8 BOM para acentuação correta no Excel em português
        keys.join(separator) + '\n' +
        rows.map(row => {
            return keys.map(k => {
                let cell = row[k] === null || row[k] === undefined ? '' : row[k];
                cell = cell.toString().replace(/"/g, '""');
                if (cell.search(/("|,|\n|;)/g) >= 0) cell = `"${cell}"`;
                return cell;
            }).join(separator);
        }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function imprimirRelatorio(titulo, elementoId) {
    const el = document.getElementById(elementoId);
    if (!el) {
        alert('Elemento de relatório não encontrado');
        return;
    }
    const conteudo = el.innerHTML;
    const janelaImpressao = window.open('', '', 'height=700,width=900');
    janelaImpressao.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${titulo} · Doutor Paladar</title>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; padding: 30px; color: #333; }
                h1 { color: #2d6a4f; margin-bottom: 5px; }
                .meta { color: #666; font-size: 0.9rem; margin-bottom: 20px; border-bottom: 2px solid #2d6a4f; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 0.9rem; }
                th { background-color: #2d6a4f; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .no-print { display: none !important; }
            </style>
        </head>
        <body>
            <h1>🍔 Doutor Paladar · ${titulo}</h1>
            <div class="meta">
                <strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')} | Cantina IFSP
            </div>
            ${conteudo}
        </body>
        </html>
    `);
    janelaImpressao.document.close();
    janelaImpressao.focus();
    setTimeout(() => { janelaImpressao.print(); }, 500);
}
