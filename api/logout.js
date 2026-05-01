import { removeSession } from "../lib/store.js";
import { getAuthToken, sendMethodNotAllowed } from "./_auth.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return sendMethodNotAllowed(res);
    }

    try {
        await removeSession(getAuthToken(req));
        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ ok: true });
    }
}
