import {
    createSession,
    createUserWithPasswordHash,
    deleteEmailVerification,
    getEmailVerification,
    getUserByEmail,
    isValidEmail,
    isVerificationCodeValid,
    normalizeEmail,
    sanitizeUser
} from "../lib/store.js";
import { sendMethodNotAllowed } from "./_auth.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return sendMethodNotAllowed(res);
    }

    try {
        const email = normalizeEmail(req.body?.email);
        const code = String(req.body?.code || "").trim();

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: "Informe um e-mail valido." });
        }

        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: "Informe o codigo de 6 numeros." });
        }

        const alreadyExists = await getUserByEmail(email);
        if (alreadyExists) {
            await deleteEmailVerification(email);
            return res.status(409).json({ error: "Este e-mail ja esta cadastrado." });
        }

        const verification = await getEmailVerification(email);
        if (!isVerificationCodeValid(verification, code)) {
            return res.status(400).json({ error: "Codigo invalido ou expirado." });
        }

        const user = await createUserWithPasswordHash({
            name: verification.name,
            email: verification.email,
            phone: verification.phone,
            passwordHash: verification.passwordHash
        });
        await deleteEmailVerification(email);

        const token = await createSession(user.id);
        return res.status(201).json({
            user: sanitizeUser(user),
            token
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || "Nao foi possivel verificar o e-mail." });
    }
}
