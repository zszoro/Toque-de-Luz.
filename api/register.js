import {
    createAuthToken,
    hashPassword,
    normalizeEmail,
    readUsers,
    sanitizeUser,
    writeUsers
} from "../lib/catalog.js";

export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (name.length < 2) {
        return res.status(400).json({ error: "Informe um nome valido." });
    }

    if (!email.includes("@")) {
        return res.status(400).json({ error: "Informe um e-mail valido." });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
    }

    const users = readUsers();
    if (users.some((user) => normalizeEmail(user.email) === email)) {
        return res.status(409).json({ error: "Este e-mail ja esta cadastrado." });
    }

    const user = {
        id: `usr_${Date.now()}_${Math.floor(Math.random() * 10_000)}`,
        name,
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
    };

    users.push(user);
    writeUsers(users);

    return res.status(201).json({
        user: sanitizeUser(user),
        token: createAuthToken(user)
    });
}
