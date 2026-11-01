/**
 * Sabor Mineiro ACK - Servidor HTTP Local com API de Produtos
 * Zero dependências externas (roda direto com Node.js)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const PRODUCTS_FILE = path.join(PUBLIC_DIR, 'products.json');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'assets', 'images');

// Garante que a pasta de uploads exista
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
    // Headers CORS para qualquer requisição
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // =========================================================================
    // API: Obter lista de produtos
    // =========================================================================
    if (pathname === '/api/products' && req.method === 'GET') {
        fs.readFile(PRODUCTS_FILE, 'utf8', (err, data) => {
            if (err) {
                return sendJSON(res, 500, { error: 'Erro ao ler arquivo de produtos' });
            }
            try {
                const products = JSON.parse(data);
                sendJSON(res, 200, products);
            } catch (parseErr) {
                sendJSON(res, 500, { error: 'Arquivo products.json corrompido' });
            }
        });
        return;
    }

    // =========================================================================
    // API: Salvar lista de produtos
    // =========================================================================
    if (pathname === '/api/products' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            // Limite de segurança 10MB
            if (body.length > 1e7) req.destroy();
        });

        req.on('end', () => {
            try {
                const products = JSON.parse(body);
                if (!Array.isArray(products)) {
                    return sendJSON(res, 400, { error: 'Dados inválidos: deve ser um array de produtos' });
                }

                fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 4), 'utf8', (err) => {
                    if (err) {
                        return sendJSON(res, 500, { error: 'Erro ao salvar produtos no disco' });
                    }
                    sendJSON(res, 200, { success: true, message: 'Cardápio atualizado com sucesso!', count: products.length });
                });
            } catch (err) {
                sendJSON(res, 400, { error: 'JSON inválido enviado' });
            }
        });
        return;
    }

    // =========================================================================
    // API: Upload de imagem (Base64)
    // =========================================================================
    if (pathname === '/api/upload' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1.5e7) req.destroy(); // 15MB
        });

        req.on('end', () => {
            try {
                const { filename, base64 } = JSON.parse(body);
                if (!filename || !base64) {
                    return sendJSON(res, 400, { error: 'Parâmetros filename e base64 são obrigatórios' });
                }

                // Extrair tipo e dados puros
                const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64, 'base64');

                // Nome de arquivo limpo e seguro
                const ext = path.extname(filename).toLowerCase() || '.jpg';
                const safeName = 'caldo-' + Date.now() + ext;
                const destPath = path.join(UPLOAD_DIR, safeName);

                fs.writeFile(destPath, buffer, (err) => {
                    if (err) {
                        return sendJSON(res, 500, { error: 'Erro ao salvar imagem' });
                    }
                    const publicUrl = `assets/images/${safeName}`;
                    sendJSON(res, 200, { success: true, url: publicUrl });
                });
            } catch (err) {
                sendJSON(res, 400, { error: 'Erro ao processar imagem enviada' });
            }
        });
        return;
    }

    // =========================================================================
    // Arquivos Estáticos
    // =========================================================================
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('403 Proibido');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
            res.end(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head><title>404 - Não Encontrado</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f0c0a; color: #fff;">
                    <h2>Página não encontrada (404)</h2>
                    <p><a href="/" style="color: #f59e0b;">Voltar para o Cardápio</a></p>
                </body>
                </html>
            `);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🍲 ========================================================`);
    console.log(`✨ Sabor Mineiro ACK rodando com sucesso!`);
    console.log(`🌐 Cardápio: http://localhost:${PORT}`);
    console.log(`⚙️ Painel Administrativo: http://localhost:${PORT}/admin.html`);
    console.log(`========================================================\n`);
});
