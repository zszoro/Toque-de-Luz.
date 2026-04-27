import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "orders.json");

function readDB() {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeDB(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getOrders() {
    return readDB();
}

export function saveOrder(order) {
    const orders = readDB();
    orders.push(order);
    writeDB(orders);
}

export function updateOrder(paymentId, status) {
    const orders = readDB();

    const index = orders.findIndex(o => o.paymentId === paymentId);

    if (index !== -1) {
        orders[index].status = status;
        writeDB(orders);
    }
}
