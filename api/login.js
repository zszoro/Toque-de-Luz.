import {
    createSession,
    getUserByEmail,
    hashPassword,
    sanitizeUser
} from "../lib/store.js";
import { sendMethodNotAllowed } from "./_auth.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return sendMethodNotAllowed(res);
    }

    try {
        const { email, password } = req.body || {};
        const user = await getUserByEmail(email);
        const passwordHash = hashPassword(password);

        if (!user || user.passwordHash !== passwordHash) {
            return res.status(401).json({ error: "E-mail ou senha invalidos." });
        }

        const token = await createSession(user.id);

        return res.status(200).json({
            user: sanitizeUser(user),
            token
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || "Nao foi possivel entrar." });
    }
}
