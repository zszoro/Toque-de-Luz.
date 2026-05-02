import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);
const DATA_DIR = path.join(ROOT_DIR, "data");

const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const TUNNEL_URL_FILE = path.join(ROOT_DIR, ".webhook-url");

const PORT = Number(process.env.PORT || 5500);
const MAX_BODY_SIZE = 1_000_000;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

const MP_MODE_TEST = "TEST";
const MP_MODE_PROD = "PROD";

loadDotEnv();
ensureCollectionFile(ORDERS_FILE);
ensureCollectionFile(USERS_FILE);
ensureCollectionFile(SESSIONS_FILE);

function loadDotEnv() {
    const envPath = path.join(ROOT_DIR, ".env");
    if (!fs.existsSync(envPath)) return;

    const raw = fs.readFileSync(envPath, "utf8");
    const lines = raw.split(/\r?\n/);

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        const eqIndex = trimmed.indexOf("=");
        if (eqIndex < 0) return;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (!process.env[key]) {
            process.env[key] = value;
        }
    });
}

function ensureCollectionFile(filePath) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "[]");
    }
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8"
    });
    res.end(JSON.stringify(payload));
}

function readCollection(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeCollection(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readOrders() {
    return readCollection(ORDERS_FILE);
}

function writeOrders(orders) {
    writeCollection(ORDERS_FILE, orders);
}

function readUsers() {
    return readCollection(USERS_FILE);
}

function writeUsers(users) {
    writeCollection(USERS_FILE, users);
}

function readSessions() {
    return readCollection(SESSIONS_FILE);
}

function writeSessions(sessions) {
    writeCollection(SESSIONS_FILE, sessions);
}

async function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                reject(new Error("Payload muito grande."));
                req.destroy();
            }
        });

        req.on("end", () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("JSON invalido no corpo da requisicao."));
            }
        });

        req.on("error", reject);
    });
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function hashPassword(password) {
    return crypto.createHash("sha256").update(String(password || "")).digest("hex");
}

function sanitizeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
    };
}

function createSession(userId) {
    const sessions = readSessions();
    const token = crypto.randomBytes(24).toString("hex");

    sessions.push({
        token,
        userId,
        createdAt: new Date().toISOString()
    });

    writeSessions(sessions);
    return token;
}

function removeSession(token) {
    if (!token) return;

    const sessions = readSessions().filter((session) => session.token !== token);
    writeSessions(sessions);
}

function getAuthToken(req, body = null) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
        return authHeader.slice(7).trim();
    }

    const headerToken = req.headers["x-account-token"];
    if (headerToken) {
        return String(headerToken).trim();
    }

    if (body?.accountToken) {
        return String(body.accountToken).trim();
    }

    return "";
}

function getUserByToken(token) {
    if (!token) return null;

    const session = readSessions().find((item) => item.token === token);
    if (!session) return null;

    const user = readUsers().find((item) => item.id === session.userId);
    return user || null;
}

function normalizeMpMode(rawMode) {
    const mode = String(rawMode || "").trim().toUpperCase();

    if (mode === MP_MODE_TEST || mode === MP_MODE_PROD) {
        return mode;
    }

    return "";
}

function isLikelyTestCredential(value) {
    return String(value || "").startsWith("TEST-");
}

function resolveMpMode() {
    const configuredMode = normalizeMpMode(process.env.MP_MODE);
    if (configuredMode) return configuredMode;

    const legacyToken = String(process.env.ACCESS_TOKEN || "");
    if (isLikelyTestCredential(legacyToken)) {
        return MP_MODE_TEST;
    }

    if (legacyToken) {
        return MP_MODE_PROD;
    }

    return MP_MODE_TEST;
}

function getActiveMercadoPagoConfig() {
    const mode = resolveMpMode();

    const testAccessToken = String(process.env.MP_TEST_ACCESS_TOKEN || "");
    const prodAccessToken = String(process.env.MP_PROD_ACCESS_TOKEN || "");
    const legacyAccessToken = String(process.env.ACCESS_TOKEN || "");

    const testPublicKey = String(process.env.MP_TEST_PUBLIC_KEY || "");
    const prodPublicKey = String(process.env.MP_PROD_PUBLIC_KEY || "");
    const legacyPublicKey = String(process.env.PUBLIC_KEY || "");

    if (mode === MP_MODE_PROD) {
        return {
            mode,
            accessToken: prodAccessToken || (!isLikelyTestCredential(legacyAccessToken) ? legacyAccessToken : ""),
            publicKey: prodPublicKey || (!isLikelyTestCredential(legacyPublicKey) ? legacyPublicKey : "")
        };
    }

    return {
        mode: MP_MODE_TEST,
        accessToken: testAccessToken || (isLikelyTestCredential(legacyAccessToken) ? legacyAccessToken : ""),
        publicKey: testPublicKey || (isLikelyTestCredential(legacyPublicKey) ? legacyPublicKey : "")
    };
}

function resolveWebhookPublicUrl() {
    const envUrl = String(process.env.MP_WEBHOOK_PUBLIC_URL || "").trim();
    if (envUrl) return envUrl.replace(/\/$/, "");

    if (fs.existsSync(TUNNEL_URL_FILE)) {
        const fileUrl = String(fs.readFileSync(TUNNEL_URL_FILE, "utf8") || "").trim();
        if (fileUrl) {
            return fileUrl.replace(/\/$/, "");
        }
    }

    return "";
}

function resolveAppBaseUrl() {
    const envUrl = String(process.env.APP_BASE_URL || "").trim();
    return envUrl ? envUrl.replace(/\/$/, "") : "";
}

function isLocalBaseUrl(baseUrl) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?/i.test(baseUrl);
}

function normalizeItems(items) {
    if (!Array.isArray(items)) return [];

    return items
        .map((item) => ({
            title: String(item?.name || "").trim(),
            quantity: 1,
            unit_price: Number(item?.price || 0)
        }))
        .filter((item) => item.title && Number.isFinite(item.unit_price) && item.unit_price > 0);
}

function normalizeBooking(booking) {
    return {
        name: String(booking?.name || "").trim(),
        email: normalizeEmail(booking?.email),
        phone: String(booking?.phone || "").trim(),
        attendanceLocation: String(booking?.attendanceLocation || "").trim(),
        date: String(booking?.date || "").trim(),
        time: String(booking?.time || "").trim(),
        notes: String(booking?.notes || "").trim()
    };
}

function updateOrderByPayment(orders, paymentId, paymentStatus, externalReference) {
    const paymentIdText = String(paymentId);
    const externalRefText = String(externalReference || "");

    const index = orders.findIndex((order) => {
        return order.id === externalRefText || String(order.paymentId || "") === paymentIdText;
    });

    if (index === -1) return false;

    orders[index].paymentId = paymentIdText;
    orders[index].status = paymentStatus || "pending";
    orders[index].updatedAt = new Date().toISOString();
    return true;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchPaymentById(paymentId, accessToken) {
    const response = await fetchWithTimeout(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    }, 20_000);

    const payment = await response.json().catch(() => ({}));
    return { response, payment };
}

async function handleRegister(req, res) {
    if (req.method !== "POST") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    let body;
    try {
        body = await readJsonBody(req);
    } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
    }

    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (name.length < 2) {
        sendJson(res, 400, { error: "Informe um nome valido." });
        return;
    }

    if (!email || !email.includes("@")) {
        sendJson(res, 400, { error: "Informe um e-mail valido." });
        return;
    }

    if (password.length < 6) {
        sendJson(res, 400, { error: "A senha deve ter pelo menos 6 caracteres." });
        return;
    }

    const users = readUsers();
    const alreadyExists = users.some((user) => normalizeEmail(user.email) === email);
    if (alreadyExists) {
        sendJson(res, 409, { error: "Este e-mail ja esta cadastrado." });
        return;
    }

    const user = {
        id: `usr_${Date.now()}_${Math.floor(Math.random() * 10_000)}`,
        name,
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
    };

    users.push(user);
    writeUsers(users);

    const token = createSession(user.id);

    sendJson(res, 201, {
        user: sanitizeUser(user),
        token
    });
}

async function handleLogin(req, res) {
    if (req.method !== "POST") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    let body;
    try {
        body = await readJsonBody(req);
    } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
    }

    const email = normalizeEmail(body.email);
    const passwordHash = hashPassword(body.password);

    const users = readUsers();
    const user = users.find((item) => normalizeEmail(item.email) === email);

    if (!user || user.passwordHash !== passwordHash) {
        sendJson(res, 401, { error: "E-mail ou senha invalidos." });
        return;
    }

    const token = createSession(user.id);
    sendJson(res, 200, {
        user: sanitizeUser(user),
        token
    });
}

function handleLogout(req, res) {
    if (req.method !== "POST") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    const token = getAuthToken(req);
    removeSession(token);
    sendJson(res, 200, { ok: true });
}

function handleMe(req, res) {
    if (req.method !== "GET") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    const token = getAuthToken(req);
    const user = getUserByToken(token);

    if (!user) {
        sendJson(res, 401, { error: "Sessao invalida." });
        return;
    }

    sendJson(res, 200, { user: sanitizeUser(user) });
}

function handleMyOrders(req, res) {
    if (req.method !== "GET") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    const token = getAuthToken(req);
    const user = getUserByToken(token);

    if (!user) {
        sendJson(res, 401, { error: "Sessao invalida." });
        return;
    }

    const orders = readOrders()
        .filter((order) => order.userId === user.id)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    sendJson(res, 200, { orders });
}

async function handleCreatePayment(req, res) {
    if (req.method !== "POST") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    const mpConfig = getActiveMercadoPagoConfig();
    if (!mpConfig.accessToken) {
        sendJson(res, 500, {
            error: `Credencial ausente para modo ${mpConfig.mode}. Configure MP_${mpConfig.mode}_ACCESS_TOKEN no arquivo .env.`
        });
        return;
    }

    let body;
    try {
        body = await readJsonBody(req);
    } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
    }

    const items = normalizeItems(body.items);
    if (items.length === 0) {
        sendJson(res, 400, { error: "Carrinho vazio ou itens invalidos." });
        return;
    }

    const booking = normalizeBooking(body.booking);
    const accountToken = getAuthToken(req, body);
    const user = getUserByToken(accountToken);
    const orderId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

    const webhookBaseUrl = resolveWebhookPublicUrl();
    const appBaseUrl = resolveAppBaseUrl();

    const mpPayload = {
        external_reference: orderId,
        items
    };

    if (booking.email) {
        mpPayload.payer = {
            email: booking.email
        };
    }

    if (webhookBaseUrl) {
        mpPayload.notification_url = `${webhookBaseUrl}/api/webhook`;
    }

    if (appBaseUrl && !isLocalBaseUrl(appBaseUrl)) {
        mpPayload.back_urls = {
            success: `${appBaseUrl}/?payment_status=approved`,
            pending: `${appBaseUrl}/?payment_status=pending`,
            failure: `${appBaseUrl}/?payment_status=failed`
        };
        mpPayload.auto_return = "approved";
    }

    try {
        const mpResponse = await fetchWithTimeout("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${mpConfig.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(mpPayload)
        }, 20_000);

        const data = await mpResponse.json().catch(() => ({}));

        if (!mpResponse.ok || !data.init_point) {
            sendJson(res, 502, {
                error: data.message || "Falha ao criar pagamento no Mercado Pago.",
                details: data
            });
            return;
        }

        const orders = readOrders();
        orders.push({
            id: orderId,
            items: body.items,
            booking,
            userId: user?.id || null,
            userEmail: user?.email || booking.email || null,
            paymentId: null,
            preferenceId: data.id || null,
            status: "pending",
            mode: mpConfig.mode,
            createdAt: new Date().toISOString()
        });
        writeOrders(orders);

        sendJson(res, 200, {
            init_point: data.init_point,
            mode: mpConfig.mode
        });
    } catch (error) {
        if (error.name === "AbortError") {
            sendJson(res, 504, { error: "Timeout ao comunicar com Mercado Pago." });
            return;
        }

        sendJson(res, 500, { error: "Erro interno ao iniciar pagamento." });
    }
}

async function handleWebhook(req, res, urlObj) {
    if (req.method !== "POST" && req.method !== "GET") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    const mpConfig = getActiveMercadoPagoConfig();
    if (!mpConfig.accessToken) {
        sendJson(res, 500, {
            error: `Credencial ausente para modo ${mpConfig.mode}. Configure MP_${mpConfig.mode}_ACCESS_TOKEN no arquivo .env.`
        });
        return;
    }

    let body = {};
    if (req.method === "POST") {
        try {
            body = await readJsonBody(req);
        } catch (error) {
            sendJson(res, 400, { error: error.message });
            return;
        }
    }

    const paymentId = body?.data?.id
        || body?.id
        || urlObj.searchParams.get("data.id")
        || urlObj.searchParams.get("id");

    if (!paymentId) {
        sendJson(res, 200, { ok: true });
        return;
    }

    try {
        const { response, payment } = await fetchPaymentById(paymentId, mpConfig.accessToken);

        if (!response.ok) {
            sendJson(res, 502, {
                error: payment.message || "Falha ao consultar pagamento no Mercado Pago.",
                details: payment
            });
            return;
        }

        const orders = readOrders();
        updateOrderByPayment(
            orders,
            paymentId,
            payment.status,
            String(payment.external_reference || "")
        );
        writeOrders(orders);

        sendJson(res, 200, { ok: true });
    } catch (error) {
        if (error.name === "AbortError") {
            sendJson(res, 504, { error: "Timeout ao consultar pagamento no Mercado Pago." });
            return;
        }

        sendJson(res, 500, { error: "Erro interno ao processar webhook." });
    }
}

async function handleWebhookTest(req, res) {
    if (req.method !== "POST") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    let body;
    try {
        body = await readJsonBody(req);
    } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
    }

    const paymentId = body.paymentId || body.id || body?.data?.id;
    if (!paymentId) {
        sendJson(res, 400, { error: "Informe paymentId para testar." });
        return;
    }

    const mpConfig = getActiveMercadoPagoConfig();
    if (!mpConfig.accessToken) {
        sendJson(res, 500, { error: "Credenciais do Mercado Pago nao configuradas." });
        return;
    }

    try {
        const { response, payment } = await fetchPaymentById(paymentId, mpConfig.accessToken);

        if (!response.ok) {
            sendJson(res, 502, {
                error: payment.message || "Falha ao consultar pagamento.",
                details: payment
            });
            return;
        }

        const orders = readOrders();
        const updated = updateOrderByPayment(
            orders,
            paymentId,
            payment.status,
            String(payment.external_reference || "")
        );

        writeOrders(orders);

        sendJson(res, 200, {
            ok: true,
            updated,
            paymentStatus: payment.status,
            externalReference: payment.external_reference || null
        });
    } catch (error) {
        if (error.name === "AbortError") {
            sendJson(res, 504, { error: "Timeout ao consultar pagamento no Mercado Pago." });
            return;
        }

        sendJson(res, 500, { error: "Erro interno ao testar webhook." });
    }
}

function handleOrders(req, res) {
    if (req.method !== "GET") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    sendJson(res, 200, readOrders());
}

function handleMpConfig(req, res) {
    if (req.method !== "GET") {
        sendJson(res, 405, { error: "Metodo nao permitido." });
        return;
    }

    const mpConfig = getActiveMercadoPagoConfig();
    const webhookBaseUrl = resolveWebhookPublicUrl();
    const appBaseUrl = resolveAppBaseUrl();

    sendJson(res, 200, {
        mode: mpConfig.mode,
        configured: Boolean(mpConfig.accessToken),
        hasTestCredentials: Boolean(process.env.MP_TEST_ACCESS_TOKEN || process.env.MP_TEST_PUBLIC_KEY),
        hasProdCredentials: Boolean(process.env.MP_PROD_ACCESS_TOKEN || process.env.MP_PROD_PUBLIC_KEY),
        webhookPublicUrl: webhookBaseUrl || null,
        webhookNotificationUrl: webhookBaseUrl ? `${webhookBaseUrl}/api/webhook` : null,
        appBaseUrl: appBaseUrl || null
    });
}

function resolveFilePath(pathname) {
    const sanitized = pathname === "/" ? "/index.html" : pathname;
    const decoded = decodeURIComponent(sanitized);
    const absolutePath = path.normalize(path.join(ROOT_DIR, decoded));

    if (!absolutePath.startsWith(ROOT_DIR)) {
        return null;
    }

    return absolutePath;
}

function serveStatic(req, res, pathname) {
    const filePath = resolveFilePath(pathname);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendJson(res, 404, { error: "Arquivo nao encontrado." });
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = urlObj;

    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Account-Token"
        });
        res.end();
        return;
    }

    if (pathname === "/api/register") {
        await handleRegister(req, res);
        return;
    }

    if (pathname === "/api/login") {
        await handleLogin(req, res);
        return;
    }

    if (pathname === "/api/logout") {
        handleLogout(req, res);
        return;
    }

    if (pathname === "/api/me") {
        handleMe(req, res);
        return;
    }

    if (pathname === "/api/my-orders") {
        handleMyOrders(req, res);
        return;
    }

    if (pathname === "/api/create-payment") {
        await handleCreatePayment(req, res);
        return;
    }

    if (pathname === "/api/webhook") {
        await handleWebhook(req, res, urlObj);
        return;
    }

    if (pathname === "/api/webhook-test") {
        await handleWebhookTest(req, res);
        return;
    }

    if (pathname === "/api/orders") {
        handleOrders(req, res);
        return;
    }

    if (pathname === "/api/mp-config") {
        handleMpConfig(req, res);
        return;
    }

    serveStatic(req, res, pathname);
});

server.listen(PORT, "0.0.0.0", () => {
    const mode = resolveMpMode();
    const webhookBaseUrl = resolveWebhookPublicUrl();
    console.log(`Servidor local ativo em http://localhost:${PORT} (Mercado Pago: ${mode})`);
    if (webhookBaseUrl) {
        console.log(`Webhook publico ativo: ${webhookBaseUrl}/api/webhook`);
    } else {
        console.log("Webhook publico inativo. Configure MP_WEBHOOK_PUBLIC_URL ou inicie o tunnel.");
    }
});
