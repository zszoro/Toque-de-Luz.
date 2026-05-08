import fs from "fs";
import path from "path";

const USERS_KEY = String(process.env.USERS_DB_KEY || "toque-de-luz:users:v1");
const USERS_FILE = path.join(process.cwd(), "data", "users.json");

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
        throw new Error(details || "Falha ao acessar banco de usuarios.");
    }

    const [result] = await response.json();
    if (result?.error) throw new Error(result.error);
    return result?.result ?? null;
}

function readUsersFile() {
    try {
        if (!fs.existsSync(USERS_FILE)) return [];
        const parsed = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeUsersFile(users) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function readStoredUsers() {
    if (getRedisConfig()) {
        const raw = await redisCommand(["GET", USERS_KEY]);
        if (!raw) return [];
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    }

    return readUsersFile();
}

export async function writeStoredUsers(users) {
    if (getRedisConfig()) {
        await redisCommand(["SET", USERS_KEY, JSON.stringify(users)]);
        return;
    }

    writeUsersFile(users);
}
