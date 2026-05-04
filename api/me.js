import { getAuthToken, getUserByToken } from "../lib/catalog.js";

export default function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const user = getUserByToken(getAuthToken(req));
    if (!user) {
        return res.status(401).json({ error: "Sessao invalida." });
    }

    return res.status(200).json({ user });
}
