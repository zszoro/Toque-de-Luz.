export function getAuthToken(req) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
        return authHeader.slice(7).trim();
    }

    const headerToken = req.headers["x-account-token"];
    if (headerToken) {
        return String(headerToken).trim();
    }

    return "";
}

export function sendMethodNotAllowed(res) {
    return res.status(405).json({ error: "Metodo nao permitido." });
}
