import fs from "fs";
import path from "path";

const ORDERS_KEY = String(process.env.ORDERS_DB_KEY || "toque-de-luz:orders:v1");
const ORDERS_FILE = path.join(process.cwd(), "data", "orders.json");

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

function getRedisConfig() {
    const url = String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
    const token = String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
    if (!url || !token) return null;
    return { url: url.replace(/\/$/, ""), token };
}

async function redisCommand(command) {
    const config = getRedisConfig();
    if (!config) return null;

    const response = await fetch(`${config.url}/pipeline`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify([command])
    });

    if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(details || "Falha ao acessar banco de pedidos.");
    }

    const [result] = await response.json();
    if (result?.error) throw new Error(result.error);
    return result?.result ?? null;
}

function getGithubRepoConfig() {
    const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim();
    const repo = String(process.env.GITHUB_REPO || "").trim();
    const branch = String(process.env.GITHUB_BRANCH || "main").trim();
    if (!token || !repo) return null;
    return { token, repo, branch };
}

async function readOrdersFromGithub(config) {
    const response = await fetch(`https://api.github.com/repos/${config.repo}/contents/data/orders.json?ref=${encodeURIComponent(config.branch)}`, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "toque-de-luz-orders"
        }
    });

    if (response.status === 404) return [];
    if (!response.ok) throw new Error("Nao foi possivel ler pedidos do GitHub.");

    const data = await response.json();
    const parsed = JSON.parse(Buffer.from(data.content || "", "base64").toString("utf8"));
    return Array.isArray(parsed) ? parsed : [];
}

async function writeOrdersToGithub(config, orders) {
    const currentResponse = await fetch(`https://api.github.com/repos/${config.repo}/contents/data/orders.json?ref=${encodeURIComponent(config.branch)}`, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "toque-de-luz-orders"
        }
    });

    const currentData = currentResponse.ok ? await currentResponse.json() : {};
    const content = Buffer.from(`${JSON.stringify(orders, null, 2)}\n`, "utf8").toString("base64");

    const response = await fetch(`https://api.github.com/repos/${config.repo}/contents/data/orders.json`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "toque-de-luz-orders"
        },
        body: JSON.stringify({
            message: "Atualiza pedidos pelo checkout",
            content,
            sha: currentData.sha || undefined,
            branch: config.branch
        })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Nao foi possivel salvar pedidos no GitHub.");
    }
}

async function readOrders() {
    if (getRedisConfig()) {
        const raw = await redisCommand(["GET", ORDERS_KEY]);
        if (!raw) return [];
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    }

    const githubConfig = getGithubRepoConfig();
    if (githubConfig) return readOrdersFromGithub(githubConfig);

    return readJsonFile(ORDERS_FILE, []);
}

async function writeOrders(orders) {
    if (getRedisConfig()) {
        await redisCommand(["SET", ORDERS_KEY, JSON.stringify(orders)]);
        return;
    }

    const githubConfig = getGithubRepoConfig();
    if (githubConfig) {
        await writeOrdersToGithub(githubConfig, orders);
        return;
    }

    writeJsonFile(ORDERS_FILE, orders);
}

export async function getOrders() {
    return readOrders();
}

export async function saveOrder(order) {
    const orders = await readOrders();
    orders.push(order);
    await writeOrders(orders);
    return order;
}

export async function updateOrder(paymentId, status, externalReference = "", payment = {}) {
    const orders = await readOrders();
    const paymentIdText = String(paymentId || "");
    const externalRefText = String(externalReference || "");

    const index = orders.findIndex((order) => {
        return String(order.id || "") === externalRefText
            || String(order.paymentId || "") === paymentIdText
            || String(order.preferenceId || "") === externalRefText;
    });

    if (index === -1) return false;

    orders[index] = {
        ...orders[index],
        paymentId: paymentIdText || orders[index].paymentId || null,
        status: status || "pending",
        paymentStatus: status || "pending",
        paymentMethod: payment.payment_method_id || orders[index].paymentMethod || null,
        paymentType: payment.payment_type_id || orders[index].paymentType || null,
        updatedAt: new Date().toISOString()
    };
    await writeOrders(orders);
    return true;
}
