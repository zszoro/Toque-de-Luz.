import {
    normalizeProductPayload,
    publicProduct,
    readProducts,
    requireAdmin,
    sortProducts,
    writeProducts
} from "../../../lib/catalog.js";

export default async function handler(req, res) {
    const admin = requireAdmin(req, req.body);
    if (admin.error) {
        return res.status(admin.statusCode).json({ error: admin.error });
    }

    const productId = String(req.query?.id || "").trim();
    if (!productId) {
        return res.status(400).json({ error: "Informe o produto." });
    }

    try {
        const products = await readProducts();
        const index = products.findIndex((product) => String(product.id || "") === productId);

        if (index === -1) {
            return res.status(404).json({ error: "Produto nao encontrado." });
        }

        if (req.method === "PATCH" || req.method === "PUT") {
            const normalized = normalizeProductPayload(req.body || {}, products[index]);
            if (normalized.error) {
                return res.status(400).json({ error: normalized.error });
            }

            const product = {
                ...normalized.product,
                id: products[index].id,
                createdAt: products[index].createdAt || null,
                updatedAt: new Date().toISOString()
            };

            products[index] = product;
            await writeProducts(sortProducts(products));
            return res.status(200).json({ product: publicProduct(product) });
        }

        if (req.method === "DELETE") {
            const [removed] = products.splice(index, 1);
            await writeProducts(sortProducts(products));
            return res.status(200).json({ ok: true, product: publicProduct(removed) });
        }

        return res.status(405).json({ error: "Metodo nao permitido." });
    } catch (error) {
        return res.status(500).json({ error: error.message || "Erro ao atualizar produto." });
    }
}
