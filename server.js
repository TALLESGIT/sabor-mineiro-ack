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
const REVIEWS_FILE = path.join(PUBLIC_DIR, 'reviews.json');
const STORE_STATUS_FILE = path.join(PUBLIC_DIR, 'store_status.json');
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
 * Inicializa as tabelas no PostgreSQL e realiza seed se estiverem vazias
 */
async function initDatabase() {
    if (!pool) return;
    try {
        const client = await pool.connect();
        try {
            // 1. Tabela de Cardápio
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

            // 2. Tabela de Avaliações dos Clientes
            await client.query(`
                CREATE TABLE IF NOT EXISTS customer_reviews (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    dish VARCHAR(150),
                    comment TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    approved BOOLEAN DEFAULT TRUE
                );
            `);

            // Limpar avaliações de exemplo/seed se ainda existirem
            await client.query("DELETE FROM customer_reviews WHERE name IN ('Mariana Souza', 'John Miller', 'Rodrigo Silva')");
            console.log('✅ PostgreSQL: Tabela de avaliações pronta (zerada para clientes reais).');
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

/**
 * Busca o status de atendimento da loja (Aberto/Fechado, Horários e Aviso)
 */
async function fetchStoreStatus() {
    if (pool) {
        try {
            const res = await pool.query("SELECT data FROM menu_config WHERE key = 'store_status'");
            if (res.rows.length > 0 && res.rows[0].data) {
                return res.rows[0].data;
            }
        } catch (err) {
            console.error('⚠️ Erro ao consultar store_status no PostgreSQL:', err.message);
        }
    }

    try {
        return JSON.parse(fs.readFileSync(STORE_STATUS_FILE, 'utf8'));
    } catch (e) {
        return { isOpen: true, hours: "17:00 - 23:00", notice: "" };
    }
}

/**
 * Grava o status da loja (PostgreSQL + arquivo local)
 */
async function persistStoreStatus(status) {
    let savedInDB = false;
    const cleanStatus = {
        isOpen: Boolean(status.isOpen),
        hours: String(status.hours || "17:00 - 23:00").trim().substring(0, 50),
        notice: String(status.notice || "").trim().substring(0, 300)
    };

    if (pool) {
        try {
            await pool.query(`
                INSERT INTO menu_config (key, data, updated_at)
                VALUES ('store_status', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
            `, [JSON.stringify(cleanStatus)]);
            savedInDB = true;
            console.log('💾 Status da loja persistido no PostgreSQL:', cleanStatus.isOpen ? 'ABERTO' : 'FECHADO');
        } catch (err) {
            console.error('⚠️ Erro ao gravar store_status no PostgreSQL:', err.message);
        }
    }

    try {
        fs.writeFileSync(STORE_STATUS_FILE, JSON.stringify(cleanStatus, null, 4), 'utf8');
    } catch (e) {
        console.warn('⚠️ Não foi possível gravar arquivo store_status.json:', e.message);
    }

    return { success: true, status: cleanStatus, savedInDB };
}

/**
 * Busca as avaliações com nota média calculada
 */
async function fetchReviews() {
    let list = [];
    if (pool) {
        try {
            const res = await pool.query(
                "SELECT id, name, rating, dish, comment, to_char(created_at, 'DD/MM/YYYY') as date_formatted FROM customer_reviews WHERE approved = true ORDER BY id DESC LIMIT 50"
            );
            list = res.rows;
        } catch (err) {
            console.error('⚠️ Erro ao consultar reviews no PostgreSQL:', err.message);
        }
    }

    if (list.length === 0) {
        try {
            list = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
        } catch (e) {
            list = [];
        }
    }

    const count = list.length;
    const avg = count > 0 
        ? (list.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / count).toFixed(1)
        : "5.0";

    return {
        reviews: list,
        averageRating: avg,
        totalCount: count
    };
}

/**
 * Adiciona uma nova avaliação enviada por cliente
 */
async function addReview({ name, rating, dish, comment }) {
    const cleanRating = Math.max(1, Math.min(5, parseInt(rating) || 5));
    const cleanName = (name || 'Cliente de Nantucket').trim().substring(0, 100);
    const cleanDish = (dish || 'Caldo').trim().substring(0, 150);
    const cleanComment = (comment || '').trim().substring(0, 1000);

    if (pool) {
        try {
            const res = await pool.query(
                "INSERT INTO customer_reviews (name, rating, dish, comment, approved) VALUES ($1, $2, $3, $4, true) RETURNING id",
                [cleanName, cleanRating, cleanDish, cleanComment]
            );
            return { success: true, id: res.rows[0].id };
        } catch (err) {
            console.error('⚠️ Erro ao gravar review no PostgreSQL:', err.message);
        }
    }

    try {
        let list = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
        const newId = Date.now();
        const now = new Date();
        const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        list.unshift({
            id: newId,
            name: cleanName,
            rating: cleanRating,
            dish: cleanDish,
            comment: cleanComment,
            date_formatted: dateFormatted,
            approved: true
        });
        fs.writeFileSync(REVIEWS_FILE, JSON.stringify(list, null, 4), 'utf8');
        return { success: true, id: newId };
    } catch (e) {
        return { success: true };
    }
}

/**
 * Remove uma avaliação (admin)
 */
async function removeReview(id) {
    if (pool) {
        try {
            await pool.query("DELETE FROM customer_reviews WHERE id = $1", [id]);
            return { success: true };
        } catch (err) {
            console.error('⚠️ Erro ao deletar review do PostgreSQL:', err.message);
        }
    }

    try {
        let list = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
        list = list.filter(r => String(r.id) !== String(id));
        fs.writeFileSync(REVIEWS_FILE, JSON.stringify(list, null, 4), 'utf8');
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

/**
 * Remove todas as avaliações (zerar)
 */
async function removeAllReviews() {
    if (pool) {
        try {
            await pool.query("TRUNCATE customer_reviews RESTART IDENTITY");
        } catch (err) {
            console.error('⚠️ Erro ao truncar reviews no PostgreSQL:', err.message);
        }
    }
    try {
        fs.writeFileSync(REVIEWS_FILE, '[]', 'utf8');
    } catch (e) {}
    return { success: true };
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
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // =========================================================================
    // API: Keep-Alive / Health Check (UptimeRobot / Cron-Job ping)
    // =========================================================================
    if ((pathname === '/health' || pathname === '/ping') && req.method === 'GET') {
        return sendJSON(res, 200, {
            status: 'ok',
            service: 'Sabor Mineiro ACK',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        });
    }

    // =========================================================================
    // API: Obter lista de produtos (PostgreSQL)
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
    // API: Salvar lista de produtos (PostgreSQL)
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
    // API: Status da Loja / Atendimento (GET)
    // =========================================================================
    if (pathname === '/api/store-status' && req.method === 'GET') {
        try {
            const status = await fetchStoreStatus();
            return sendJSON(res, 200, status);
        } catch (err) {
            return sendJSON(res, 500, { error: 'Erro ao buscar status da loja' });
        }
    }

    // =========================================================================
    // API: Status da Loja / Atendimento (POST)
    // =========================================================================
    if (pathname === '/api/store-status' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 5e5) req.destroy();
        });

        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const result = await persistStoreStatus(data);
                sendJSON(res, 200, result);
            } catch (err) {
                sendJSON(res, 400, { error: 'JSON inválido enviado' });
            }
        });
        return;
    }

    // =========================================================================
    // API: Avaliações dos Clientes (GET)
    // =========================================================================
    if (pathname === '/api/reviews' && req.method === 'GET') {
        try {
            const data = await fetchReviews();
            return sendJSON(res, 200, data);
        } catch (err) {
            return sendJSON(res, 500, { error: 'Erro ao carregar avaliações' });
        }
    }

    // =========================================================================
    // API: Avaliações dos Clientes (POST)
    // =========================================================================
    if (pathname === '/api/reviews' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 5e5) req.destroy(); // 500KB
        });

        req.on('end', async () => {
            try {
                const reviewData = JSON.parse(body);
                if (!reviewData.comment || !reviewData.name) {
                    return sendJSON(res, 400, { error: 'Nome e comentário são obrigatórios' });
                }

                const result = await addReview(reviewData);
                sendJSON(res, 200, {
                    success: true,
                    message: 'Avaliação enviada com sucesso! Muito obrigado pelo carinho.',
                    id: result.id
                });
            } catch (err) {
                sendJSON(res, 400, { error: 'Dados inválidos enviados' });
            }
        });
        return;
    }

    // =========================================================================
    // API: Avaliações dos Clientes (DELETE)
    // =========================================================================
    if (pathname === '/api/reviews' && req.method === 'DELETE') {
        const id = parsedUrl.searchParams.get('id');
        if (!id) {
            return sendJSON(res, 400, { error: 'ID da avaliação não informado' });
        }
        if (id === 'all') {
            await removeAllReviews();
            return sendJSON(res, 200, { success: true, message: 'Todas as avaliações foram zeradas com sucesso' });
        }
        await removeReview(id);
        return sendJSON(res, 200, { success: true, message: 'Avaliação removida' });
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
        console.log(`✨ Sabor Mineiro ACK rodando com suporte a PostgreSQL & Avaliações!`);
        console.log(`🌐 Cardápio: http://localhost:${PORT}`);
        console.log(`⚙️ Painel Administrativo: http://localhost:${PORT}/admin.html`);
        console.log(`========================================================\n`);
    });
});
