import {
    createProductId,
    normalizeProductPayload,
    publicProduct,
    readProducts,
    requireAdmin,
    sortProducts,
    writeProducts
} from "../../lib/catalog.js";

export default async function handler(req, res) {
    const admin = requireAdmin(req, req.body);
    if (admin.error) {
        return res.status(admin.statusCode).json({ error: admin.error });
    }

    try {
        const products = await readProducts();

        if (req.method === "GET") {
            return res.status(200).json({ products: sortProducts(products).map(publicProduct) });
        }

        if (req.method === "POST") {
            const normalized = normalizeProductPayload(req.body || {});
            if (normalized.error) {
                return res.status(400).json({ error: normalized.error });
            }

            const maxSortOrder = products.reduce((max, product) => {
                const sortOrder = Number(product.sortOrder || 0);
                return Number.isFinite(sortOrder) && sortOrder > max ? sortOrder : max;
            }, 0);
            const product = {
                id: createProductId(normalized.product.name, products),
                ...normalized.product,
                sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : maxSortOrder + 10,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            products.push(product);
            await writeProducts(sortProducts(products));
            return res.status(201).json({ product: publicProduct(product) });
        }

        return res.status(405).json({ error: "Metodo nao permitido." });
    } catch (error) {
        return res.status(500).json({ error: error.message || "Erro ao atualizar produtos." });
    }
}
