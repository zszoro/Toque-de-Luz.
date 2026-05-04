import { createAuthToken, findUserForLogin, sanitizeUser } from "../lib/catalog.js";

export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const email = req.body?.email;
    const password = req.body?.password;
    const user = findUserForLogin(email, password);

    if (!user) {
        return res.status(401).json({ error: "E-mail ou senha invalidos." });
    }

    return res.status(200).json({
        user: sanitizeUser(user),
        token: createAuthToken(user)
    });
}
