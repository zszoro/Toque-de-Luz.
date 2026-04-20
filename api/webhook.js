export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(200).json({ ok: true });
    }

    try {
        console.log("🔔 Webhook recebido:", req.body);

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error(error);
        return res.status(200).json({ ok: true });
    }
}
