import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// 🔥 ROTA DE TESTE
app.get("/", (req, res) => {
    res.send("Backend rodando!");
});

// 🔥 WEBHOOK DO MERCADO PAGO
app.post("/webhook", async (req, res) => {
    try {
        console.log("🔔 Webhook recebido:", req.body);

        const paymentId = req.body?.data?.id;

        if (!paymentId) {
            console.log("❌ Sem ID");
            return res.sendStatus(200);
        }

        // 🔎 Consulta pagamento real
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                Authorization: `Bearer ${process.env.ACCESS_TOKEN}`
            }
        });

        const payment = await response.json();

        console.log("💰 Status:", payment.status);

        if (payment.status === "approved") {
            console.log("✅ PAGAMENTO APROVADO");

            // 👉 AQUI você atualiza seu sistema
            // exemplo:
            // - salvar pedido como pago
            // - diminuir estoque
        }

        res.sendStatus(200);

    } catch (error) {
        console.error("🔥 Erro:", error);
        res.sendStatus(500);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
