import {
    createAuthToken,
    findUserForLogin,
    getAuthToken,
    getUserByToken,
    hashPassword,
    normalizeEmail,
    readUsers,
    sanitizeUser,
    writeUsers
} from "../../lib/catalog.js";

function getAction(req) {
    const rawAction = req.query?.action;
    return Array.isArray(rawAction) ? rawAction[0] : String(rawAction || "");
}

function handleLogin(req, res) {
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

function handleLogout(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    return res.status(200).json({ ok: true });
}

function handleMe(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const user = getUserByToken(getAuthToken(req));
    if (!user) {
        return res.status(401).json({ error: "Sessao invalida." });
    }

    return res.status(200).json({ user });
}

function handleRegister(req, res) {
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

export default function handler(req, res) {
    const action = getAction(req);

    if (action === "login") return handleLogin(req, res);
    if (action === "logout") return handleLogout(req, res);
    if (action === "me") return handleMe(req, res);
    if (action === "register") return handleRegister(req, res);

    return res.status(404).json({ error: "Endpoint de autenticacao nao encontrado." });
}
