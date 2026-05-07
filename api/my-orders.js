import { getOrders } from "../lib/db.js";
import { getAuthToken, getUserByToken } from "../lib/catalog.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const user = getUserByToken(getAuthToken(req));
    if (!user) {
        return res.status(401).json({ error: "Sessao invalida." });
    }

    const orders = (await getOrders())
        .filter((order) => order.userId === user.id || order.userEmail === user.email)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return res.status(200).json({ orders });
}
