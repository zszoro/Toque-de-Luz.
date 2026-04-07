let cart = [];

// ========================
// ATUALIZAR CARRINHO
// ========================
function updateCart() {
    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");
    const cartCount = document.getElementById("cartCount");
    const checkoutBtn = document.getElementById("checkoutBtn");

    cartItems.innerHTML = "";

    if (cart.length === 0) {
        cartItems.innerHTML = "<p class='empty-cart'>Seu carrinho está vazio</p>";
        cartTotal.innerText = "R$ 0,00";
        cartCount.innerText = "0";
        checkoutBtn.disabled = true;
        return;
    }

    let total = 0;

    cart.forEach((item, index) => {
        total += item.price;

        const div = document.createElement("div");
        div.classList.add("cart-item");

        div.innerHTML = `
            <strong>${item.name}</strong><br>
            <small>${item.duration}</small><br>
            R$ ${item.price.toFixed(2)}
            <br>
            <button onclick="removeFromCart(${index})">Remover</button>
        `;

        cartItems.appendChild(div);
    });

    cartTotal.innerText = `R$ ${total.toFixed(2)}`;
    cartCount.innerText = cart.length;

    // 🔥 CORREÇÃO BOTÃO FINALIZAR
    checkoutBtn.disabled = false;
    checkoutBtn.onclick = openCheckoutModal;
}

// ========================
// ADICIONAR AO CARRINHO
// ========================
function addToCart(name, price, duration) {
    cart.push({ name, price, duration });
    updateCart();
    showNotification(`${name} adicionado ao carrinho`);
}

// ========================
// REMOVER ITEM
// ========================
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCart();
}

// ========================
// ABRIR/FECHAR CARRINHO
// ========================
function toggleCart(event) {
    event.preventDefault();
    const cartSidebar = document.getElementById("cartSidebar");
    cartSidebar.classList.toggle("active");
}

// ========================
// NOTIFICAÇÕES EMPILHADAS
// ========================
function showNotification(message) {
    let container = document.getElementById("notifContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "notifContainer";
        container.style.position = "fixed";
        container.style.top = "80px";
        container.style.right = "20px";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "10px";
        container.style.zIndex = "9999";
        document.body.appendChild(container);
    }

    const notif = document.createElement("div");
    notif.className = "cart-notification";
    notif.innerText = message;

    container.appendChild(notif);

    setTimeout(() => {
        notif.remove();
    }, 2000);
}

// ========================
// PACOTES
// ========================
function addPackageToCart(type) {
    const packages = {
        "inicial": { name: "Pacote Inicial", price: 200 },
        "bem-estar": { name: "Pacote Bem-Estar", price: 350 },
        "premium": { name: "Pacote Premium", price: 500 }
    };

    const pkg = packages[type];
    if (!pkg) return;

    cart.push({
        name: pkg.name,
        price: pkg.price,
        duration: "Pacote"
    });

    updateCart();
    showNotification(pkg.name + " adicionado");
}

// ========================
// CHECKOUT
// ========================
function openCheckoutModal() {
    const modal = document.getElementById("checkoutModal");
    const checkoutItems = document.getElementById("checkoutItems");
    const checkoutTotal = document.getElementById("checkoutTotal");

    checkoutItems.innerHTML = "";

    let total = 0;

    cart.forEach(item => {
        total += item.price;

        const div = document.createElement("div");
        div.innerHTML = `${item.name} - R$ ${item.price.toFixed(2)}`;
        checkoutItems.appendChild(div);
    });

    checkoutTotal.innerText = `R$ ${total.toFixed(2)}`;
    modal.style.display = "flex";
}

function closeCheckoutModal() {
    document.getElementById("checkoutModal").style.display = "none";
}

// ========================
// CONFIRMAÇÃO
// ========================
document.getElementById("checkoutForm").addEventListener("submit", function(e) {
    e.preventDefault();

    document.getElementById("checkoutModal").style.display = "none";
    document.getElementById("confirmationModal").style.display = "flex";

    cart = [];
    updateCart();
});

function closeConfirmationModal() {
    document.getElementById("confirmationModal").style.display = "none";
}
