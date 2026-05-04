import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function readJsonFile(filePath, fallback = []) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function writeJsonFile(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

export function hashPassword(password) {
    return crypto.createHash("sha256").update(String(password || "")).digest("hex");
}

export function getAdminEmails() {
    return String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
        .split(",")
        .map(normalizeEmail)
        .filter(Boolean);
}

function timingSafeTextCompare(a, b) {
    const left = Buffer.from(String(a || ""));
    const right = Buffer.from(String(b || ""));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

export function isAdminEmail(email) {
    return getAdminEmails().includes(normalizeEmail(email));
}

export function isAdminPassword(password) {
    const plainPassword = String(process.env.ADMIN_PASSWORD || "");
    const passwordHash = String(process.env.ADMIN_PASSWORD_HASH || "");

    if (passwordHash) {
        return timingSafeTextCompare(hashPassword(password), passwordHash);
    }

    if (plainPassword) {
        return timingSafeTextCompare(password, plainPassword);
    }

    return false;
}

export function readUsers() {
    return readJsonFile(USERS_FILE, []);
}

export function sanitizeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: Boolean(user.isAdmin || user.role === "admin" || isAdminEmail(user.email)),
        createdAt: user.createdAt || null
    };
}

export function findUserForLogin(email, password) {
    const normalizedEmail = normalizeEmail(email);

    if (isAdminEmail(normalizedEmail) && isAdminPassword(password)) {
        return {
            id: `admin_${hashPassword(normalizedEmail).slice(0, 12)}`,
            name: "Admin Toque de Luz",
            email: normalizedEmail,
            role: "admin",
            isAdmin: true,
            createdAt: null
        };
    }

    const passwordHash = hashPassword(password);
    const user = readUsers().find((item) => normalizeEmail(item.email) === normalizedEmail);
    if (!user || user.passwordHash !== passwordHash) return null;

    return {
        ...user,
        isAdmin: isAdminEmail(user.email) || user.role === "admin"
    };
}

function getSessionSecret() {
    return String(
        process.env.ADMIN_SESSION_SECRET
        || process.env.ADMIN_PASSWORD_HASH
        || process.env.ADMIN_PASSWORD
        || process.env.MP_PROD_ACCESS_TOKEN
        || process.env.ACCESS_TOKEN
        || "toque-de-luz-local-session"
    );
}

function base64Url(input) {
    return Buffer.from(input).toString("base64url");
}

function signTokenPayload(payloadText) {
    return crypto.createHmac("sha256", getSessionSecret()).update(payloadText).digest("base64url");
}

export function createAuthToken(user) {
    const payload = {
        id: user.id,
        name: user.name,
        email: normalizeEmail(user.email),
        isAdmin: Boolean(user.isAdmin || user.role === "admin" || isAdminEmail(user.email)),
        exp: Date.now() + 1000 * 60 * 60 * 12
    };
    const payloadText = base64Url(JSON.stringify(payload));
    const signature = signTokenPayload(payloadText);
    return `${payloadText}.${signature}`;
}

export function getAuthToken(req, body = null) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
        return authHeader.slice(7).trim();
    }

    const headerToken = req.headers["x-account-token"];
    if (headerToken) return String(headerToken).trim();

    if (body?.accountToken) return String(body.accountToken).trim();
    return "";
}

export function getUserByToken(token) {
    if (!token || !token.includes(".")) return null;

    const [payloadText, signature] = token.split(".");
    const expectedSignature = signTokenPayload(payloadText);
    if (!timingSafeTextCompare(signature, expectedSignature)) return null;

    try {
        const payload = JSON.parse(Buffer.from(payloadText, "base64url").toString("utf8"));
        if (!payload.exp || Date.now() > Number(payload.exp)) return null;
        return sanitizeUser(payload);
    } catch {
        return null;
    }
}

export function requireAdmin(req, body = null) {
    const token = getAuthToken(req, body);
    const user = getUserByToken(token);

    if (!user) {
        return { statusCode: 401, error: "Faca login para acessar o painel admin." };
    }

    if (!user.isAdmin) {
        return { statusCode: 403, error: "Esta conta nao tem permissao de admin." };
    }

    return { user };
}

function getGithubRepoConfig() {
    const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim();
    const repo = String(process.env.GITHUB_REPO || "").trim();
    const branch = String(process.env.GITHUB_BRANCH || "main").trim();

    if (!token || !repo) return null;
    return { token, repo, branch };
}

async function readProductsFromGithub(config) {
    const response = await fetch(`https://api.github.com/repos/${config.repo}/contents/data/products.json?ref=${encodeURIComponent(config.branch)}`, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "toque-de-luz-admin"
        }
    });

    if (!response.ok) {
        throw new Error("Nao foi possivel ler produtos do GitHub.");
    }

    const data = await response.json();
    return JSON.parse(Buffer.from(data.content || "", "base64").toString("utf8"));
}

async function writeProductsToGithub(config, products) {
    const currentResponse = await fetch(`https://api.github.com/repos/${config.repo}/contents/data/products.json?ref=${encodeURIComponent(config.branch)}`, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "toque-de-luz-admin"
        }
    });

    const currentData = currentResponse.ok ? await currentResponse.json() : {};
    const content = Buffer.from(`${JSON.stringify(products, null, 2)}\n`, "utf8").toString("base64");

    const response = await fetch(`https://api.github.com/repos/${config.repo}/contents/data/products.json`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "toque-de-luz-admin"
        },
        body: JSON.stringify({
            message: "Atualiza produtos pelo painel admin",
            content,
            sha: currentData.sha || undefined,
            branch: config.branch
        })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Nao foi possivel salvar produtos no GitHub.");
    }
}

export async function readProducts() {
    const githubConfig = getGithubRepoConfig();
    if (githubConfig) {
        return readProductsFromGithub(githubConfig);
    }

    return readJsonFile(PRODUCTS_FILE, []);
}

export async function writeProducts(products) {
    const githubConfig = getGithubRepoConfig();
    if (githubConfig) {
        await writeProductsToGithub(githubConfig, products);
        return;
    }

    writeJsonFile(PRODUCTS_FILE, products);
}

export function sortProducts(products) {
    return [...products].sort((a, b) => {
        const orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 0;
        const orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
    });
}

export function publicProduct(product) {
    return {
        id: String(product.id || ""),
        type: product.type === "package" ? "package" : "service",
        category: String(product.category || ""),
        name: String(product.name || ""),
        duration: String(product.duration || ""),
        price: Number(product.price || 0),
        description: String(product.description || ""),
        details: Array.isArray(product.details) ? product.details.map(String) : [],
        featured: Boolean(product.featured),
        active: product.active !== false,
        sortOrder: Number(product.sortOrder || 0)
    };
}

function normalizeDetails(details, fallback = []) {
    if (Array.isArray(details)) {
        return details.map((item) => String(item || "").trim()).filter(Boolean);
    }

    if (typeof details === "string") {
        return details.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    }

    return Array.isArray(fallback) ? fallback.map(String).filter(Boolean) : [];
}

export function normalizeProductPayload(payload, existingProduct = {}) {
    const name = String(payload.name ?? existingProduct.name ?? "").trim();
    const type = String(payload.type ?? existingProduct.type ?? "service").trim().toLowerCase();
    const category = String(payload.category ?? existingProduct.category ?? "").trim();
    const duration = String(payload.duration ?? existingProduct.duration ?? "").trim();
    const description = String(payload.description ?? existingProduct.description ?? "").trim();
    const price = Number(payload.price ?? existingProduct.price);
    const sortOrder = Number(payload.sortOrder ?? existingProduct.sortOrder ?? 0);

    if (name.length < 2) return { error: "Informe o nome do produto." };
    if (type !== "service" && type !== "package") return { error: "Tipo de produto invalido." };
    if (!category) return { error: "Informe uma categoria." };
    if (!Number.isFinite(price) || price < 0) return { error: "Informe um preco valido." };

    return {
        product: {
            ...existingProduct,
            type,
            category,
            name,
            duration,
            price,
            description,
            details: normalizeDetails(payload.details, existingProduct.details),
            featured: payload.featured === undefined ? Boolean(existingProduct.featured) : Boolean(payload.featured),
            active: payload.active === undefined ? existingProduct.active !== false : Boolean(payload.active),
            sortOrder: Number.isFinite(sortOrder) ? sortOrder : Number(existingProduct.sortOrder || 0)
        }
    };
}

export function createProductId(name, products) {
    const baseId = String(name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `produto-${Date.now()}`;
    const ids = new Set(products.map((product) => product.id));

    if (!ids.has(baseId)) return baseId;

    let counter = 2;
    while (ids.has(`${baseId}-${counter}`)) counter += 1;
    return `${baseId}-${counter}`;
}
