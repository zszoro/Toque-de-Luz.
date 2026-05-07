import { getOrders } from "../lib/db.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const orders = await getOrders();
    return res.status(200).json(orders);
}
