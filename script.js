let cart = [];
const CUSTOM_PACKAGE_DISCOUNT = 0.15;

const AUTH_TOKEN_KEY = "toque_de_luz_auth_token";
const AUTH_USER_KEY = "toque_de_luz_auth_user";

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
let authUser = null;

try {
    const storedUser = localStorage.getItem(AUTH_USER_KEY);
    authUser = storedUser ? JSON.parse(storedUser) : null;
} catch {
    authUser = null;
}

function formatCurrency(value) {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function getFirstName(fullName) {
    const name = String(fullName || "").trim();
    return name.split(" ")[0] || "Minha Conta";
}

function setAccountMessage(message, isError = false) {
    const messageEl = document.getElementById("accountMessage");
    if (!messageEl) return;

    messageEl.textContent = message || "";
    messageEl.classList.toggle("error", Boolean(message && isError));
    messageEl.classList.toggle("success", Boolean(message && !isError));
}

function saveAuthState(token, user) {
    authToken = token;
    authUser = user;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    updateAccountButtonLabel();
}

function clearAuthState() {
    authToken = "";
    authUser = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    updateAccountButtonLabel();
}

function getAuthHeaders(baseHeaders = {}) {
    const headers = { ...baseHeaders };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
}

function updateAccountButtonLabel() {
    const label = document.getElementById("accountButtonLabel");
    const accountButton = document.getElementById("accountButton");
    if (!label || !accountButton) return;

    if (authUser?.name) {
        label.textContent = getFirstName(authUser.name);
        accountButton.classList.add("logged-in");
        return;
    }

    label.textContent = "Minha Conta";
    accountButton.classList.remove("logged-in");
}

function closeCartSidebar() {
    const cartSidebar = document.getElementById("cartSidebar");
    if (cartSidebar) {
        cartSidebar.classList.remove("active");
    }
}

function openAccountModal(event) {
    if (event) event.preventDefault();

    const modal = document.getElementById("accountModal");
    if (!modal) return;

    modal.style.display = "flex";
    document.body.classList.add("modal-open");
    setAccountMessage("");

    if (authToken && authUser) {
        showLoggedAccountSection();
        loadMyOrders();
    } else {
        showAuthSection();
        switchAccountTab("login");
    }
}

function closeAccountModal() {
    const modal = document.getElementById("accountModal");
    if (!modal) return;

    modal.style.display = "none";
    document.body.classList.remove("modal-open");
    setAccountMessage("");
}

function switchAccountTab(tab) {
    const loginTab = document.getElementById("loginTabBtn");
    const registerTab = document.getElementById("registerTabBtn");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (!loginTab || !registerTab || !loginForm || !registerForm) return;

    const showLogin = tab === "login";

    loginTab.classList.toggle("active", showLogin);
    registerTab.classList.toggle("active", !showLogin);
    loginForm.classList.toggle("hidden-form", !showLogin);
    registerForm.classList.toggle("hidden-form", showLogin);
    setAccountMessage("");
}

function showAuthSection() {
    const authSection = document.getElementById("accountAuthSection");
    const loggedSection = document.getElementById("accountLoggedSection");
    const subtitle = document.getElementById("accountSubtitle");

    if (authSection) authSection.classList.remove("hidden-form");
    if (loggedSection) loggedSection.classList.add("hidden-form");
    if (subtitle) subtitle.textContent = "Entre ou crie uma conta para acompanhar seus pedidos.";
}

function showLoggedAccountSection() {
    const authSection = document.getElementById("accountAuthSection");
    const loggedSection = document.getElementById("accountLoggedSection");
    const subtitle = document.getElementById("accountSubtitle");

    if (authSection) authSection.classList.add("hidden-form");
    if (loggedSection) loggedSection.classList.remove("hidden-form");
    if (subtitle) subtitle.textContent = "Pedidos salvos na sua conta.";

    const nameDisplay = document.getElementById("accountNameDisplay");
    const emailDisplay = document.getElementById("accountEmailDisplay");

    if (nameDisplay) nameDisplay.textContent = authUser?.name || "";
    if (emailDisplay) emailDisplay.textContent = authUser?.email || "";
}

function renderAccountOrders(orders) {
    const list = document.getElementById("accountOrdersList");
    if (!list) return;

    if (!orders.length) {
        list.innerHTML = "<p class='empty-cart'>Sem pedidos vinculados a esta conta.</p>";
        return;
    }

    const orderCards = orders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const total = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        const created = order.createdAt ? new Date(order.createdAt).toLocaleString("pt-BR") : "-";

        const itemLines = items
            .map((item) => `<li>${item.name} - ${formatCurrency(Number(item.price) || 0)}</li>`)
            .join("");

        return `
            <div class="account-order-card">
                <div class="account-order-head">
                    <strong>Pedido ${order.id}</strong>
                    <span class="order-status ${order.status || "pending"}">${order.status || "pending"}</span>
                </div>
                <p class="account-order-meta">Criado em: ${created}</p>
                <ul class="account-order-items">${itemLines}</ul>
                <p class="account-order-total">Total: ${formatCurrency(total)}</p>
            </div>
        `;
    });

    list.innerHTML = orderCards.join("");
}

async function loadMyOrders() {
    if (!authToken) {
        renderAccountOrders([]);
        return;
    }

    try {
        const response = await fetch("/api/my-orders", {
            headers: getAuthHeaders()
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel carregar seus pedidos.");
        }

        renderAccountOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
        setAccountMessage(error.message || "Falha ao carregar pedidos.", true);
    }
}

async function loginAccount(event) {
    event.preventDefault();
    setAccountMessage("");

    const email = document.getElementById("loginEmail")?.value?.trim();
    const password = document.getElementById("loginPassword")?.value || "";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel entrar.");
        }

        saveAuthState(data.token, data.user);
        showLoggedAccountSection();
        setAccountMessage("Login realizado com sucesso.");
        loadMyOrders();
    } catch (error) {
        setAccountMessage(error.message || "Falha no login.", true);
    }
}

async function registerAccount(event) {
    event.preventDefault();
    setAccountMessage("");

    const name = document.getElementById("registerName")?.value?.trim();
    const email = document.getElementById("registerEmail")?.value?.trim();
    const password = document.getElementById("registerPassword")?.value || "";

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel criar conta.");
        }

        saveAuthState(data.token, data.user);
        showLoggedAccountSection();
        setAccountMessage("Conta criada com sucesso.");
        loadMyOrders();
    } catch (error) {
        setAccountMessage(error.message || "Falha ao criar conta.", true);
    }
}

async function logoutAccount() {
    try {
        if (authToken) {
            await fetch("/api/logout", {
                method: "POST",
                headers: getAuthHeaders({
                    "Content-Type": "application/json"
                })
            });
        }
    } catch {
        // ignore network errors and clear local session anyway
    }

    clearAuthState();
    showAuthSection();
    switchAccountTab("login");
    renderAccountOrders([]);
    setAccountMessage("Sessao encerrada.");
}

async function refreshAuthState() {
    updateAccountButtonLabel();

    if (!authToken) return;

    try {
        const response = await fetch("/api/me", {
            headers: getAuthHeaders()
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.user) {
            clearAuthState();
            return;
        }

        saveAuthState(authToken, data.user);
    } catch {
        clearAuthState();
    }
}

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
        cartItems.innerHTML = "<p class='empty-cart'>Seu carrinho esta vazio</p>";
        cartTotal.innerText = formatCurrency(0);
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
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>${item.duration}</p>
            </div>
            <span class="cart-item-price">${formatCurrency(item.price)}</span>
            <button type="button" class="remove-item" onclick="removeFromCart(${index})" aria-label="Remover ${item.name}">
                Remover
            </button>
        `;

        cartItems.appendChild(div);
    });

    cartTotal.innerText = formatCurrency(total);
    cartCount.innerText = cart.length;
    checkoutBtn.disabled = false;
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
// CARRINHO
// ========================
function toggleCart(event) {
    if (event) {
        event.preventDefault();
    }

    document.getElementById("cartSidebar").classList.toggle("active");
}

// ========================
// NOTIFICACOES EMPILHADAS
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
        inicial: { name: "Pacote Inicial", price: 200 },
        "bem-estar": { name: "Pacote Bem-Estar", price: 350 },
        premium: { name: "Pacote Premium", price: 500 }
    };

    const pkg = packages[type];
    if (!pkg) return;

    cart.push({
        name: pkg.name,
        price: pkg.price,
        duration: "Pacote"
    });

    updateCart();
    showNotification(`${pkg.name} adicionado`);
}

function openCustomPackageModal() {
    const modal = document.getElementById("customPackageModal");
    if (!modal) return;

    modal.style.display = "flex";
    document.body.classList.add("modal-open");
    updateCustomPackageSummary();
}

function closeCustomPackageModal() {
    const modal = document.getElementById("customPackageModal");
    if (!modal) return;

    modal.style.display = "none";
    document.body.classList.remove("modal-open");
}

function getCustomPackageSelections() {
    const modalItems = document.querySelectorAll("#customPackageModal .modal-service-item");
    const selections = [];

    modalItems.forEach((itemEl) => {
        const checkbox = itemEl.querySelector(".service-checkbox");
        const quantityInput = itemEl.querySelector(".quantity-input");

        if (!checkbox || !quantityInput || !checkbox.checked) return;

        const quantity = Math.max(0, Number(quantityInput.value) || 0);
        const price = Number(checkbox.dataset.price) || 0;
        const name = checkbox.dataset.name || "Servico";

        if (quantity > 0) {
            selections.push({ name, price, quantity });
        }
    });

    return selections;
}

function updateCustomPackageSummary() {
    const totalPriceEl = document.getElementById("totalPrice");
    const discountAmountEl = document.getElementById("discountAmount");
    const finalPriceEl = document.getElementById("finalPrice");
    const confirmButton = document.querySelector("#customPackageModal .modal-confirm-button");

    const selections = getCustomPackageSelections();
    const subtotal = selections.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const hasItems = selections.length > 0;
    const discount = hasItems ? subtotal * CUSTOM_PACKAGE_DISCOUNT : 0;
    const finalTotal = subtotal - discount;

    totalPriceEl.innerText = formatCurrency(subtotal);
    discountAmountEl.innerText = `- ${formatCurrency(discount)}`;
    finalPriceEl.innerText = formatCurrency(finalTotal);

    if (confirmButton) {
        confirmButton.disabled = !hasItems;
    }
}

function confirmCustomPackage() {
    const selections = getCustomPackageSelections();

    if (selections.length === 0) {
        alert("Selecione pelo menos um servico para montar seu pacote.");
        return;
    }

    const subtotal = selections.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = subtotal * CUSTOM_PACKAGE_DISCOUNT;
    const discountedTotal = Number((subtotal - discount).toFixed(2));
    const totalQty = selections.reduce((sum, item) => sum + item.quantity, 0);

    cart.push({
        name: "Pacote Personalizado",
        price: discountedTotal,
        duration: `${totalQty} servicos`
    });

    updateCart();
    closeCustomPackageModal();
    showNotification("Pacote personalizado adicionado ao carrinho");
}

function bindCustomPackageControls() {
    const modalItems = document.querySelectorAll("#customPackageModal .modal-service-item");

    modalItems.forEach((itemEl) => {
        const checkbox = itemEl.querySelector(".service-checkbox");
        const quantityInput = itemEl.querySelector(".quantity-input");

        if (!checkbox || !quantityInput) return;

        quantityInput.disabled = !checkbox.checked;

        checkbox.addEventListener("change", () => {
            if (checkbox.checked && Number(quantityInput.value) <= 0) {
                quantityInput.value = "1";
            }

            if (!checkbox.checked) {
                quantityInput.value = "0";
            }

            quantityInput.disabled = !checkbox.checked;
            updateCustomPackageSummary();
        });

        quantityInput.addEventListener("input", () => {
            let qty = Number(quantityInput.value) || 0;

            if (qty < 0) qty = 0;
            if (qty > 10) qty = 10;

            quantityInput.value = String(qty);
            checkbox.checked = qty > 0;
            quantityInput.disabled = !checkbox.checked;
            updateCustomPackageSummary();
        });
    });

    updateCustomPackageSummary();
}

// ========================
// CHECKOUT (MODAL)
// ========================
function prefillCheckoutFromAccount() {
    if (!authUser) return;

    const nameInput = document.getElementById("checkoutName");
    const emailInput = document.getElementById("checkoutEmail");

    if (nameInput && !nameInput.value.trim()) {
        nameInput.value = authUser.name || "";
    }

    if (emailInput && !emailInput.value.trim()) {
        emailInput.value = authUser.email || "";
    }
}

function openCheckoutModal() {
    closeCartSidebar();
    prefillCheckoutFromAccount();

    const modal = document.getElementById("checkoutModal");
    modal.style.display = "flex";
    document.body.classList.add("modal-open");

    const checkoutItems = document.getElementById("checkoutItems");
    const checkoutTotal = document.getElementById("checkoutTotal");

    checkoutItems.innerHTML = "";

    let total = 0;

    cart.forEach((item) => {
        total += item.price;

        const div = document.createElement("div");
        div.className = "checkout-item";
        div.innerHTML = `
            <span class="checkout-item-name">${item.name}</span>
            <span class="checkout-item-duration">${item.duration}</span>
            <span class="checkout-item-price">${formatCurrency(item.price)}</span>
        `;
        checkoutItems.appendChild(div);
    });

    checkoutTotal.innerText = formatCurrency(total);
}

function closeCheckoutModal() {
    document.getElementById("checkoutModal").style.display = "none";
    document.body.classList.remove("modal-open");
}

function closeConfirmationModal() {
    document.getElementById("confirmationModal").style.display = "none";
}

function bindAccountForms() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (loginForm) {
        loginForm.addEventListener("submit", loginAccount);
    }

    if (registerForm) {
        registerForm.addEventListener("submit", registerAccount);
    }
}

// ========================
// CONFIRMACAO
// ========================
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("checkoutForm");
    bindCustomPackageControls();
    bindAccountForms();
    refreshAuthState();

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (cart.length === 0) return;

            const submitButton = form.querySelector("button[type='submit']");
            const originalButtonText = submitButton ? submitButton.textContent : "";

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Processando...";
            }

            const booking = {
                name: document.getElementById("checkoutName")?.value?.trim() || "",
                email: document.getElementById("checkoutEmail")?.value?.trim() || "",
                phone: document.getElementById("checkoutPhone")?.value?.trim() || "",
                date: document.getElementById("checkoutDate")?.value || "",
                time: document.getElementById("checkoutTime")?.value || "",
                notes: document.getElementById("checkoutNotes")?.value?.trim() || ""
            };

            try {
                const response = await fetch("/api/create-payment", {
                    method: "POST",
                    headers: getAuthHeaders({
                        "Content-Type": "application/json"
                    }),
                    body: JSON.stringify({
                        items: cart,
                        booking,
                        accountToken: authToken || undefined
                    })
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.error || "Nao foi possivel iniciar o pagamento.");
                }

                if (data.init_point) {
                    window.location.href = data.init_point;
                } else {
                    throw new Error(data.error || "Resposta invalida do servidor de pagamento.");
                }
            } catch (error) {
                console.error(error);
                alert(error.message || "Erro no pagamento");
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            }
        });
    }

    const checkoutBtn = document.getElementById("checkoutBtn");
    if (checkoutBtn) {
        checkoutBtn.onclick = openCheckoutModal;
    }
});
