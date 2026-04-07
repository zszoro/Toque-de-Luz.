let cart = [];

// Atualizar carrinho na tela
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
    checkoutBtn.disabled = false;
}

// Adicionar item
function addToCart(name, price, duration) {
    cart.push({ name, price, duration });
    updateCart();
    showNotification(`${name} adicionado ao carrinho`);
}

// Remover item
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCart();
}

// Abrir/fechar carrinho
function toggleCart(event) {
    event.preventDefault();
    const cartSidebar = document.getElementById("cartSidebar");
    cartSidebar.classList.toggle("active");
}

// Notificação
function showNotification(message) {
    const notif = document.createElement("div");
    notif.className = "cart-notification";
    notif.innerText = message;

    document.body.appendChild(notif);

    setTimeout(() => {
        notif.remove();
    }, 2000);
}

// Checkout
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

// Finalizar pedido
document.getElementById("checkoutForm").addEventListener("submit", function(e) {
    e.preventDefault();

    document.getElementById("checkoutModal").style.display = "none";
    document.getElementById("confirmationModal").style.display = "flex";

    cart = [];
    updateCart();
});

// Fechar confirmação
function closeConfirmationModal() {
    document.getElementById("confirmationModal").style.display = "none";
}
