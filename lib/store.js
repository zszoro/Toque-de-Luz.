import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.REDIS_REST_API_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.REDIS_REST_API_TOKEN || "";
const IS_VERCEL = Boolean(process.env.VERCEL);

function hasRedis() {
    return Boolean(REDIS_URL && REDIS_TOKEN);
}

function requireWritableStore() {
    if (hasRedis()) return;

    if (IS_VERCEL) {
        throw new Error("Banco permanente nao configurado no Vercel. Adicione Upstash Redis ao projeto e redeploy.");
    }
}

async function redis(command) {
    if (!REDIS_URL.startsWith("http")) {
        throw new Error("Use a URL REST do Redis, nao a URL rediss://.");
    }

    const response = await fetch(REDIS_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${REDIS_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(command)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
        throw new Error(data.error || "Falha ao acessar o banco.");
    }

    return data.result;
}

async function redisGetJson(key, fallback = null) {
    const raw = await redis(["GET", key]);
    if (!raw) return fallback;
    return JSON.parse(raw);
}

async function redisSetJson(key, value) {
    await redis(["SET", key, JSON.stringify(value)]);
}

function ensureDataFile(filePath) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "[]");
    }
}

function readCollection(filePath) {
    ensureDataFile(filePath);
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeCollection(filePath, data) {
    ensureDataFile(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

export function normalizePhone(phone) {
    return String(phone || "").trim();
}

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

export function isValidPhone(phone) {
    const digits = normalizePhone(phone).replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 11;
}

export function hashPassword(password) {
    return crypto.createHash("sha256").update(String(password || "")).digest("hex");
}

export function sanitizeUser(user) {
    if (!user) return null;

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        createdAt: user.createdAt
    };
}

export function normalizeCartItems(items) {
    if (!Array.isArray(items)) return [];

    return items
        .map((item) => ({
            name: String(item?.name || "").trim(),
            price: Number(item?.price || 0),
            duration: String(item?.duration || "").trim()
        }))
        .filter((item) => item.name && Number.isFinite(item.price) && item.price > 0);
}

export async function getUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);

    if (hasRedis()) {
        const userId = await redis(["GET", `user:email:${normalizedEmail}`]);
        return userId ? redisGetJson(`user:${userId}`) : null;
    }

    return readCollection(USERS_FILE).find((user) => normalizeEmail(user.email) === normalizedEmail) || null;
}

export async function getUserById(userId) {
    if (!userId) return null;

    if (hasRedis()) {
        return redisGetJson(`user:${userId}`);
    }

    return readCollection(USERS_FILE).find((user) => user.id === userId) || null;
}

export async function createUser({ name, email, phone, password }) {
    requireWritableStore();

    const normalizedEmail = normalizeEmail(email);
    const user = {
        id: `usr_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        name: String(name || "").trim(),
        email: normalizedEmail,
        phone: normalizePhone(phone),
        cart: [],
        cartUpdatedAt: null,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
    };

    if (hasRedis()) {
        await redisSetJson(`user:${user.id}`, user);
        await redis(["SET", `user:email:${normalizedEmail}`, user.id]);
        return user;
    }

    const users = readCollection(USERS_FILE);
    users.push(user);
    writeCollection(USERS_FILE, users);
    return user;
}

export async function createSession(userId) {
    requireWritableStore();

    const token = crypto.randomBytes(24).toString("hex");
    const session = {
        token,
        userId,
        createdAt: new Date().toISOString()
    };

    if (hasRedis()) {
        await redisSetJson(`session:${token}`, session);
        return token;
    }

    const sessions = readCollection(SESSIONS_FILE);
    sessions.push(session);
    writeCollection(SESSIONS_FILE, sessions);
    return token;
}

export async function removeSession(token) {
    if (!token) return;

    if (hasRedis()) {
        await redis(["DEL", `session:${token}`]);
        return;
    }

    const sessions = readCollection(SESSIONS_FILE).filter((session) => session.token !== token);
    writeCollection(SESSIONS_FILE, sessions);
}

export async function getUserByToken(token) {
    if (!token) return null;

    if (hasRedis()) {
        const session = await redisGetJson(`session:${token}`);
        return session?.userId ? getUserById(session.userId) : null;
    }

    const session = readCollection(SESSIONS_FILE).find((item) => item.token === token);
    return session ? getUserById(session.userId) : null;
}

export async function saveUserCart(userId, items) {
    requireWritableStore();

    const user = await getUserById(userId);
    if (!user) return null;

    const updatedUser = {
        ...user,
        cart: normalizeCartItems(items),
        cartUpdatedAt: new Date().toISOString()
    };

    if (hasRedis()) {
        await redisSetJson(`user:${userId}`, updatedUser);
    } else {
        const users = readCollection(USERS_FILE);
        const index = users.findIndex((item) => item.id === userId);
        if (index !== -1) {
            users[index] = updatedUser;
            writeCollection(USERS_FILE, users);
        }
    }

    return updatedUser;
}

export async function saveOrder(order) {
    requireWritableStore();

    const storedOrder = {
        ...order,
        createdAt: order.createdAt || new Date().toISOString()
    };

    if (hasRedis()) {
        await redisSetJson(`order:${storedOrder.id}`, storedOrder);
        await redis(["LPUSH", "orders", storedOrder.id]);

        if (storedOrder.userId) {
            await redis(["LPUSH", `orders:user:${storedOrder.userId}`, storedOrder.id]);
        }

        if (storedOrder.paymentId) {
            await redis(["SET", `order:payment:${storedOrder.paymentId}`, storedOrder.id]);
        }

        return storedOrder;
    }

    const orders = readCollection(ORDERS_FILE);
    orders.push(storedOrder);
    writeCollection(ORDERS_FILE, orders);
    return storedOrder;
}

async function getOrdersByIds(ids) {
    const orders = await Promise.all(ids.map((id) => redisGetJson(`order:${id}`)));
    return orders.filter(Boolean);
}

export async function getOrders() {
    if (hasRedis()) {
        const ids = await redis(["LRANGE", "orders", 0, 100]) || [];
        return getOrdersByIds(ids);
    }

    return readCollection(ORDERS_FILE);
}

export async function getOrdersForUser(userId) {
    if (hasRedis()) {
        const ids = await redis(["LRANGE", `orders:user:${userId}`, 0, 100]) || [];
        return getOrdersByIds(ids);
    }

    return readCollection(ORDERS_FILE).filter((order) => order.userId === userId);
}

export async function updateOrder(paymentId, status, externalReference = "") {
    if (hasRedis()) {
        let orderId = externalReference || "";

        if (!orderId && paymentId) {
            orderId = await redis(["GET", `order:payment:${paymentId}`]) || "";
        }

        if (!orderId) return false;

        const order = await redisGetJson(`order:${orderId}`);
        if (!order) return false;

        const updatedOrder = {
            ...order,
            paymentId: String(paymentId || order.paymentId || ""),
            status,
            updatedAt: new Date().toISOString()
        };

        await redisSetJson(`order:${orderId}`, updatedOrder);
        if (paymentId) await redis(["SET", `order:payment:${paymentId}`, orderId]);
        return true;
    }

    const orders = readCollection(ORDERS_FILE);
    const index = orders.findIndex((order) => {
        return order.id === externalReference || String(order.paymentId || "") === String(paymentId || "");
    });

    if (index === -1) return false;

    orders[index].paymentId = String(paymentId || orders[index].paymentId || "");
    orders[index].status = status;
    orders[index].updatedAt = new Date().toISOString();
    writeCollection(ORDERS_FILE, orders);
    return true;
}
