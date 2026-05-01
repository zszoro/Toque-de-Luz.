import {
    getUserByToken,
    normalizeCartItems,
    saveUserCart
} from "../lib/store.js";
import { getAuthToken } from "./_auth.js";

export default async function handler(req, res) {
    try {
        const user = await getUserByToken(getAuthToken(req));

        if (!user) {
            return res.status(401).json({ error: "Sessao invalida." });
        }

        if (req.method === "GET") {
            return res.status(200).json({
                items: normalizeCartItems(user.cart),
                updatedAt: user.cartUpdatedAt || null
            });
        }

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Metodo nao permitido." });
        }

        const updatedUser = await saveUserCart(user.id, req.body?.items || []);

        return res.status(200).json({
            items: normalizeCartItems(updatedUser?.cart),
            updatedAt: updatedUser?.cartUpdatedAt || null
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || "Nao foi possivel salvar o carrinho da conta." });
    }
}
