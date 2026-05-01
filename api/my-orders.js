import { getOrdersForUser, getUserByToken } from "../lib/store.js";
import { getAuthToken, sendMethodNotAllowed } from "./_auth.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return sendMethodNotAllowed(res);
    }

    try {
        const user = await getUserByToken(getAuthToken(req));

        if (!user) {
            return res.status(401).json({ error: "Sessao invalida." });
        }

        const orders = await getOrdersForUser(user.id);
        orders.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

        return res.status(200).json({ orders });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Nao foi possivel carregar seus pedidos." });
    }
}
