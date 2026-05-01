import {
    createSession,
    createUser,
    getUserByEmail,
    isValidEmail,
    isValidPhone,
    sanitizeUser
} from "../lib/store.js";
import { sendMethodNotAllowed } from "./_auth.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return sendMethodNotAllowed(res);
    }

    try {
        const { name, email, phone, password } = req.body || {};
        const cleanName = String(name || "").trim();
        const cleanPassword = String(password || "");

        if (cleanName.length < 2) {
            return res.status(400).json({ error: "Informe um nome valido." });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: "Informe um e-mail valido." });
        }

        if (!isValidPhone(phone)) {
            return res.status(400).json({ error: "Informe um telefone valido com DDD." });
        }

        if (cleanPassword.length < 6) {
            return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
        }

        const alreadyExists = await getUserByEmail(email);
        if (alreadyExists) {
            return res.status(409).json({ error: "Este e-mail ja esta cadastrado." });
        }

        const user = await createUser({ name: cleanName, email, phone, password: cleanPassword });
        const token = await createSession(user.id);

        return res.status(201).json({
            user: sanitizeUser(user),
            token
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Nao foi possivel criar a conta." });
    }
}
