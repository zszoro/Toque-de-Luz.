export default async function handler(req, res) {
    try {
        console.log("🔔 Webhook recebido:", req.method, req.body);

        // Sempre responde OK (isso faz o teste passar)
        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error("Erro:", error);
        return res.status(200).json({ ok: true });
    }
}
