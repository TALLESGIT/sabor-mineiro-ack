/**
 * Sabor Mineiro ACK - Servidor HTTP com suporte nativo a PostgreSQL
 * Persistência definitiva na nuvem (Render.com) com fallback para JSON local
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const PRODUCTS_FILE = path.join(PUBLIC_DIR, 'products.json');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'assets', 'images');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configuração do PostgreSQL nativo
let pool = null;
if (process.env.DATABASE_URL) {
    const isLocalhost = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isLocalhost ? false : { rejectUnauthorized: false }
    });
    console.log('🔌 Conectando ao PostgreSQL nativo via DATABASE_URL...');
} else {
    console.log('ℹ️ DATABASE_URL não encontrada. Usando armazenamento em arquivo products.json.');
}

/**
 * Inicializa a tabela no PostgreSQL e realiza seed se estiver vazia
 */
async function initDatabase() {
    if (!pool) return;
    try {
        const client = await pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS menu_config (
                    key VARCHAR(50) PRIMARY KEY,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            const res = await client.query("SELECT data FROM menu_config WHERE key = 'products'");
            if (res.rows.length === 0) {
                let initial = [];
                try {
                    initial = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
                } catch (e) {
                    initial = [];
                }
                await client.query(
                    "INSERT INTO menu_config (key, data, updated_at) VALUES ('products', $1, NOW())",
                    [JSON.stringify(initial)]
                );
                console.log('✅ Tabela menu_config criada e populada com os caldos iniciais!');
            } else {
                console.log('✅ PostgreSQL ativo! Cardápio carregado com sucesso do banco.');
            }
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('⚠️ Falha ao inicializar PostgreSQL:', err.message);
        console.log('ℹ️ Continuando com fallback para disco.');
    }
}

/**
 * Busca a lista de produtos (PostgreSQL -> disco)
 */
async function fetchProducts() {
    if (pool) {
        try {
            const res = await pool.query("SELECT data FROM menu_config WHERE key = 'products'");
            if (res.rows.length > 0 && Array.isArray(res.rows[0].data)) {
                return res.rows[0].data;
            }
        } catch (err) {
            console.error('⚠️ Erro ao consultar banco, usando arquivo:', err.message);
        }
    }

    try {
        return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

/**
 * Grava a lista de produtos (PostgreSQL + cópia no disco)
 */
async function persistProducts(products) {
    let savedInDB = false;
    if (pool) {
        try {
            await pool.query(`
                INSERT INTO menu_config (key, data, updated_at)
                VALUES ('products', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
            `, [JSON.stringify(products)]);
            savedInDB = true;
            console.log('💾 Cardápio persistido permanentemente no PostgreSQL!');
        } catch (err) {
            console.error('⚠️ Erro ao gravar no PostgreSQL:', err.message);
        }
    }

    try {
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 4), 'utf8');
    } catch (e) {
        console.warn('⚠️ Não foi possível gravar arquivo local:', e.message);
    }

    return { savedInDB };
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

const server = http.createServer(async (req, res) => {
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
    // API: Obter lista de produtos (Lê do PostgreSQL)
    // =========================================================================
    if (pathname === '/api/products' && req.method === 'GET') {
        try {
            const products = await fetchProducts();
            return sendJSON(res, 200, products);
        } catch (err) {
            return sendJSON(res, 500, { error: 'Erro ao carregar cardápio' });
        }
    }

    // =========================================================================
    // API: Salvar lista de produtos (Grava no PostgreSQL)
    // =========================================================================
    if (pathname === '/api/products' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 2e7) req.destroy(); // 20MB
        });

        req.on('end', async () => {
            try {
                const products = JSON.parse(body);
                if (!Array.isArray(products)) {
                    return sendJSON(res, 400, { error: 'Dados inválidos: deve ser um array de produtos' });
                }

                const result = await persistProducts(products);
                sendJSON(res, 200, {
                    success: true,
                    message: 'Cardápio salvo com sucesso!',
                    savedInDB: result.savedInDB,
                    count: products.length
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

                const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64, 'base64');

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
                sendJSON(res, 400, { error: 'Erro ao processar imagem' });
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

initDatabase().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🍲 ========================================================`);
        console.log(`✨ Sabor Mineiro ACK rodando com suporte a PostgreSQL!`);
        console.log(`🌐 Cardápio: http://localhost:${PORT}`);
        console.log(`⚙️ Painel Administrativo: http://localhost:${PORT}/admin.html`);
        console.log(`========================================================\n`);
    });
});
