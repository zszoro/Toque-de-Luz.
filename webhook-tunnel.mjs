import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import localtunnel from "localtunnel";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5500);
const TUNNEL_URL_FILE = path.join(ROOT_DIR, ".webhook-url");

const subdomain = String(process.env.LT_SUBDOMAIN || "").trim() || undefined;

const tunnel = await localtunnel({
    port: PORT,
    subdomain
});

const publicUrl = String(tunnel.url || "").replace(/\/$/, "");
fs.writeFileSync(TUNNEL_URL_FILE, `${publicUrl}\n`);

console.log(`Tunnel ativo: ${publicUrl}`);
console.log(`Webhook publico: ${publicUrl}/api/webhook`);
console.log("Deixe este processo aberto para receber webhooks.");

const cleanup = () => {
    try {
        fs.unlinkSync(TUNNEL_URL_FILE);
    } catch {
        // file may not exist
    }
};

process.on("SIGINT", () => {
    cleanup();
    tunnel.close();
    process.exit(0);
});

process.on("SIGTERM", () => {
    cleanup();
    tunnel.close();
    process.exit(0);
});

tunnel.on("close", () => {
    cleanup();
});

setInterval(() => {}, 60_000);
