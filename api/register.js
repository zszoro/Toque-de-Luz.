import {
    generateVerificationCode,
    getUserByEmail,
    isValidEmail,
    isValidPhone,
    saveEmailVerification,
    sendVerificationEmail
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

        const code = generateVerificationCode();
        await saveEmailVerification({ name: cleanName, email, phone, password: cleanPassword, code });
        await sendVerificationEmail(email, code);

        return res.status(200).json({
            verificationRequired: true,
            email: String(email || "").trim().toLowerCase(),
            message: "Enviamos um codigo para seu e-mail. Digite o codigo para criar a conta."
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || "Nao foi possivel criar a conta." });
    }
}
