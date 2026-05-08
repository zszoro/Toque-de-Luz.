let cart = [];
let products = [];
let adminProducts = [];
const CUSTOM_PACKAGE_DISCOUNT = 0.15;

const AUTH_TOKEN_KEY = "toque_de_luz_auth_token";
const AUTH_USER_KEY = "toque_de_luz_auth_user";

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
let authUser = null;
let checkoutGuestMode = false;
let checkoutPaymentState = {
    publicKey: "",
    brickController: null,
    orderId: "",
    preferenceId: "",
    initPoint: "",
    booking: null
};

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

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function sortCatalogItems(items) {
    return [...items].sort((a, b) => {
        const orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 0;
        const orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
    });
}

function groupByCategory(items) {
    return sortCatalogItems(items).reduce((groups, item) => {
        const category = item.category || "Servicos";
        if (!groups[category]) groups[category] = [];
        groups[category].push(item);
        return groups;
    }, {});
}

function getProductDuration(product) {
    return product.duration || (product.type === "package" ? "Pacote" : "");
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
    updateAdminEntryVisibility();
    if (!label || !accountButton) return;

    if (authUser?.name) {
        label.textContent = getFirstName(authUser.name);
        accountButton.classList.add("logged-in");
        return;
    }

    label.textContent = "Minha Conta";
    accountButton.classList.remove("logged-in");
}

function updateAdminEntryVisibility() {
    const adminNavItem = document.getElementById("adminNavItem");
    if (adminNavItem) {
        adminNavItem.classList.remove("visible");
    }
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
        const response = await fetch("/api/auth/login", {
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
        updateCheckoutAccountState();
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
        const response = await fetch("/api/auth/register", {
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
        updateCheckoutAccountState();
    } catch (error) {
        setAccountMessage(error.message || "Falha ao criar conta.", true);
    }
}

async function logoutAccount() {
    try {
        if (authToken) {
            await fetch("/api/auth/logout", {
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
    updateCheckoutAccountState();
}

async function refreshAuthState() {
    updateAccountButtonLabel();

    if (!authToken) return;

    try {
        const response = await fetch("/api/auth/me", {
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

async function loadProducts() {
    try {
        const response = await fetch("/api/products");
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel carregar produtos.");
        }

        products = Array.isArray(data.products) ? data.products : [];
        renderCatalogProducts();
        renderCustomPackageProducts();
    } catch (error) {
        console.warn(error);
    }
}

function renderCatalogProducts() {
    const servicesContainer = document.querySelector("#services .container");
    if (!servicesContainer) return;

    const activeProducts = products.filter((product) => product.active !== false);
    const services = activeProducts.filter((product) => product.type !== "package");
    const packages = activeProducts.filter((product) => product.type === "package");
    const serviceGroups = groupByCategory(services);

    const serviceSections = Object.entries(serviceGroups).map(([category, items]) => `
        <div class="service-category">
            <h3 class="category-title">${escapeHtml(category)}</h3>
            <div class="service-grid">
                ${items.map(renderServiceCard).join("")}
            </div>
        </div>
    `).join("");

    servicesContainer.innerHTML = `
        <h2>Nossos Serviços</h2>
        ${serviceSections || "<p class='empty-catalog'>Nenhum serviço cadastrado.</p>"}
        <div class="packages-section">
            <h3 class="category-title">Pacotes Especiais</h3>
            <div class="packages-grid">
                ${packages.map(renderPackageCard).join("")}
                ${renderCustomPackageCard()}
            </div>
        </div>
    `;
}

function renderServiceCard(product) {
    return `
        <div class="service-card">
            <h4>${escapeHtml(product.name)}</h4>
            <p class="duration">${escapeHtml(getProductDuration(product))}</p>
            <p class="price">${formatCurrency(Number(product.price) || 0)}</p>
            <button class="add-to-cart-btn" onclick="addProductToCart('${escapeHtml(product.id)}')">Adicionar ao Carrinho</button>
        </div>
    `;
}

function renderPackageCard(product) {
    const details = Array.isArray(product.details) ? product.details : [];
    const detailList = details.length
        ? `<ul class="package-features">${details.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : `<p class="custom-description">${escapeHtml(product.description || "Pacote especial")}</p>`;

    return `
        <div class="package-card ${product.featured ? "featured" : ""}">
            <div class="package-header">
                <h4>${escapeHtml(product.name)}</h4>
                <p class="package-subtitle">${escapeHtml(product.description || getProductDuration(product))}</p>
                <p class="package-price">${formatCurrency(Number(product.price) || 0)}</p>
            </div>
            ${detailList}
            <button class="package-button" onclick="addProductToCart('${escapeHtml(product.id)}')">Adicionar ao Carrinho</button>
        </div>
    `;
}

function renderCustomPackageCard() {
    return `
        <div class="package-card custom">
            <div class="package-header">
                <h4>Personalizado</h4>
                <p class="package-subtitle">Monte seu próprio pacote</p>
            </div>
            <p class="custom-description">Escolha os serviços que mais combinam com você e ganhe desconto especial.</p>
            <button class="package-button custom-button" onclick="openCustomPackageModal()">Montar Meu Pacote</button>
        </div>
    `;
}

function renderCustomPackageProducts() {
    const modalServices = document.querySelector("#customPackageModal .modal-services");
    if (!modalServices) return;

    const services = products.filter((product) => product.active !== false && product.type !== "package");
    const groups = groupByCategory(services);

    if (services.length === 0) {
        modalServices.innerHTML = "<p class='empty-catalog'>Nenhum serviço cadastrado para montar pacote.</p>";
        return;
    }

    modalServices.innerHTML = Object.entries(groups).map(([category, items]) => `
        <div class="modal-category">
            <h3>${escapeHtml(category)}</h3>
            ${items.map((product) => `
                <div class="modal-service-item">
                    <label>
                        <input type="checkbox" class="service-checkbox" data-name="${escapeHtml(product.name)}" data-price="${Number(product.price) || 0}" data-product-id="${escapeHtml(product.id)}">
                        <span>${escapeHtml(product.name)} (${escapeHtml(getProductDuration(product))}) - ${formatCurrency(Number(product.price) || 0)}</span>
                    </label>
                    <input type="number" class="quantity-input" min="0" max="10" value="0">
                </div>
            `).join("")}
        </div>
    `).join("");
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
function addToCart(name, price, duration, productId = "") {
    cart.push({ name, price, duration, productId });
    updateCart();
    showNotification(`${name} adicionado ao carrinho`);
}

function addProductToCart(productId) {
    const product = products.find((item) => item.id === productId && item.active !== false);
    if (!product) {
        showNotification("Produto indisponivel no momento");
        return;
    }

    addToCart(product.name, Number(product.price) || 0, getProductDuration(product), product.id);
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
    notif.innerHTML = `<span class="cart-notification-square" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`;
    container.appendChild(notif);

    setTimeout(() => {
        notif.remove();
    }, 2000);
}

// ========================
// PACOTES
// ========================
function addPackageToCart(type) {
    const dynamicPackages = {
        inicial: "pacote-inicial",
        "bem-estar": "pacote-bem-estar",
        premium: "pacote-premium"
    };
    const dynamicProduct = products.find((product) => product.id === dynamicPackages[type]);
    if (dynamicProduct) {
        addProductToCart(dynamicProduct.id);
        return;
    }

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

function updateCheckoutAccountState() {
    const choice = document.getElementById("checkoutAccountChoice");
    const status = document.getElementById("checkoutAccountStatus");

    if (!choice || !status) return;

    if (authUser) {
        checkoutGuestMode = false;
        choice.classList.add("hidden-form");
        status.textContent = `Pedido vinculado a conta de ${authUser.name || authUser.email}.`;
        status.classList.add("success");
        return;
    }

    choice.classList.toggle("hidden-form", checkoutGuestMode);
    status.classList.remove("success");
    status.textContent = checkoutGuestMode
        ? "Voce continuara sem conta. Preencha os dados abaixo para finalizar."
        : "";
}

function openAccountFromCheckout() {
    openAccountModal();
}

function continueCheckoutAsGuest() {
    checkoutGuestMode = true;
    updateCheckoutAccountState();
}

function openCheckoutModal() {
    closeCartSidebar();
    prefillCheckoutFromAccount();
    checkoutGuestMode = false;
    resetEmbeddedPayment();

    const modal = document.getElementById("checkoutModal");
    modal.style.display = "flex";
    document.body.classList.add("modal-open");
    updateCheckoutAccountState();

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
    resetEmbeddedPayment();
}

function getCheckoutBooking() {
    return {
        name: document.getElementById("checkoutName")?.value?.trim() || "",
        email: document.getElementById("checkoutEmail")?.value?.trim() || "",
        phone: document.getElementById("checkoutPhone")?.value?.trim() || "",
        attendanceLocation: document.querySelector("input[name='attendanceLocation']:checked")?.value || "",
        date: document.getElementById("checkoutDate")?.value || "",
        time: document.getElementById("checkoutTime")?.value || "",
        notes: document.getElementById("checkoutNotes")?.value?.trim() || ""
    };
}

function getCheckoutTotalAmount() {
    return cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
}

function setPaymentBrickMessage(message, isError = false) {
    const messageEl = document.getElementById("paymentBrickMessage");
    if (!messageEl) return;

    messageEl.textContent = message || "";
    messageEl.classList.toggle("error", Boolean(message && isError));
    messageEl.classList.toggle("success", Boolean(message && !isError));
}

function resetEmbeddedPayment() {
    if (checkoutPaymentState.brickController?.unmount) {
        checkoutPaymentState.brickController.unmount();
    }

    checkoutPaymentState = {
        publicKey: checkoutPaymentState.publicKey || "",
        brickController: null,
        orderId: "",
        preferenceId: "",
        initPoint: "",
        booking: null
    };

    const section = document.getElementById("embeddedPaymentSection");
    const container = document.getElementById("paymentBrickContainer");
    const accountButton = document.getElementById("mercadoPagoAccountButton");

    if (section) section.classList.add("hidden-form");
    if (container) container.innerHTML = "";
    if (accountButton) accountButton.disabled = true;
    setPaymentBrickMessage("");
}

async function getMercadoPagoPublicKey() {
    if (checkoutPaymentState.publicKey) return checkoutPaymentState.publicKey;

    const response = await fetch("/api/mp-config");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.publicKey) {
        throw new Error("Chave publica do Mercado Pago ausente.");
    }

    checkoutPaymentState.publicKey = data.publicKey;
    return data.publicKey;
}

async function createCheckoutPreference(booking) {
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

    if (!data.preferenceId || !data.init_point) {
        throw new Error(data.error || "Resposta invalida do servidor de pagamento.");
    }

    return data;
}

async function renderEmbeddedPayment(preferenceData, booking) {
    const section = document.getElementById("embeddedPaymentSection");
    const accountButton = document.getElementById("mercadoPagoAccountButton");

    if (section) section.classList.remove("hidden-form");
    if (accountButton) accountButton.disabled = false;

    checkoutPaymentState.orderId = preferenceData.orderId || "";
    checkoutPaymentState.preferenceId = preferenceData.preferenceId || "";
    checkoutPaymentState.initPoint = preferenceData.init_point || "";
    checkoutPaymentState.booking = booking;

    if (!window.MercadoPago) {
        setPaymentBrickMessage("Nao foi possivel carregar Pix e cartao. Use a conta Mercado Pago abaixo.", true);
        return;
    }

    const publicKey = await getMercadoPagoPublicKey();
    const mp = new MercadoPago(publicKey, { locale: "pt-BR" });
    const bricksBuilder = mp.bricks();

    if (checkoutPaymentState.brickController?.unmount) {
        checkoutPaymentState.brickController.unmount();
    }

    const settings = {
        initialization: {
            amount: getCheckoutTotalAmount(),
            preferenceId: preferenceData.preferenceId,
            payer: {
                email: booking.email
            }
        },
        customization: {
            paymentMethods: {
                creditCard: "all",
                debitCard: "all",
                bankTransfer: "pix"
            }
        },
        callbacks: {
            onReady: () => setPaymentBrickMessage(""),
            onError: (error) => {
                console.error(error);
                setPaymentBrickMessage("Nao foi possivel carregar Pix e cartao.", true);
            },
            onSubmit: (submission) => {
                const formData = submission?.formData || submission || {};

                return new Promise(async (resolve, reject) => {
                    try {
                        const response = await fetch("/api/process-payment", {
                            method: "POST",
                            headers: getAuthHeaders({
                                "Content-Type": "application/json"
                            }),
                            body: JSON.stringify({
                                ...formData,
                                formData,
                                orderId: checkoutPaymentState.orderId,
                                preferenceId: checkoutPaymentState.preferenceId,
                                items: cart,
                                booking: checkoutPaymentState.booking,
                                accountToken: authToken || undefined
                            })
                        });
                        const data = await response.json().catch(() => ({}));

                        if (!response.ok) {
                            throw new Error(data.error || "Nao foi possivel processar o pagamento.");
                        }

                        setPaymentBrickMessage("Pagamento enviado ao Mercado Pago.");

                        if (["approved", "pending", "in_process"].includes(String(data.status || ""))) {
                            cart = [];
                            updateCart();
                            if (authToken) loadMyOrders();
                        }

                        resolve(data);
                    } catch (error) {
                        console.error(error);
                        setPaymentBrickMessage(error.message || "Erro no pagamento.", true);
                        reject(error);
                    }
                });
            }
        }
    };

    checkoutPaymentState.brickController = await bricksBuilder.create(
        "payment",
        "paymentBrickContainer",
        settings
    );
}

function payWithMercadoPagoAccount() {
    if (!checkoutPaymentState.initPoint) {
        setPaymentBrickMessage("Confirme o agendamento antes de pagar.", true);
        return;
    }

    window.location.href = checkoutPaymentState.initPoint;
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

function setAdminMessage(message, isError = false) {
    const messageEl = document.getElementById("adminMessage");
    if (!messageEl) return;

    messageEl.textContent = message || "";
    messageEl.classList.toggle("error", Boolean(message && isError));
    messageEl.classList.toggle("success", Boolean(message && !isError));
}

function showAdminLogin() {
    const loginSection = document.getElementById("adminLoginSection");
    const panel = document.getElementById("adminPanel");

    if (loginSection) loginSection.classList.remove("hidden-form");
    if (panel) panel.classList.add("hidden-form");
}

function showAdminPanel() {
    const loginSection = document.getElementById("adminLoginSection");
    const panel = document.getElementById("adminPanel");
    const userName = document.getElementById("adminUserName");

    if (loginSection) loginSection.classList.add("hidden-form");
    if (panel) panel.classList.remove("hidden-form");
    if (userName) {
        userName.textContent = authUser?.name ? `Logado como ${authUser.name}` : "";
    }
}

async function loginAdmin(event) {
    event.preventDefault();
    setAdminMessage("");

    const email = document.getElementById("adminEmail")?.value?.trim();
    const password = document.getElementById("adminPassword")?.value || "";

    try {
        const response = await fetch("/api/auth/login", {
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

        if (!data.user?.isAdmin) {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${data.token}`
                }
            }).catch(() => {});
            clearAuthState();
            throw new Error("Esta conta nao tem permissao de admin.");
        }

        saveAuthState(data.token, data.user);
        showAdminPanel();
        await loadAdminProducts();
    } catch (error) {
        setAdminMessage(error.message || "Falha no login.", true);
        showAdminLogin();
    }
}

async function loadAdminProducts() {
    try {
        const response = await fetch("/api/admin/products", {
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            clearAuthState();
            showAdminLogin();
            throw new Error(data.error || "Faca login para acessar o painel admin.");
        }

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel carregar produtos.");
        }

        adminProducts = Array.isArray(data.products) ? data.products : [];
        renderAdminProducts();
        showAdminPanel();
        setAdminMessage("");
    } catch (error) {
        setAdminMessage(error.message || "Falha ao carregar produtos.", true);
    }
}

function renderAdminProducts() {
    const list = document.getElementById("adminProductsList");
    if (!list) return;

    if (!adminProducts.length) {
        list.innerHTML = "<p class='empty-catalog'>Nenhum produto cadastrado.</p>";
        return;
    }

    list.innerHTML = sortCatalogItems(adminProducts).map((product) => `
        <article class="admin-product-card ${product.active === false ? "inactive" : ""}">
            <div class="admin-product-main">
                <div>
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.category)} • ${escapeHtml(product.type === "package" ? "Pacote" : "Serviço")}</p>
                </div>
                <span class="admin-status ${product.active === false ? "inactive" : "active"}">${product.active === false ? "Inativo" : "Ativo"}</span>
            </div>
            <div class="admin-product-meta">
                <span>${formatCurrency(Number(product.price) || 0)}</span>
                <span>${escapeHtml(getProductDuration(product) || "-")}</span>
            </div>
            <div class="admin-product-actions">
                <button type="button" class="reset-button" onclick="editAdminProduct('${escapeHtml(product.id)}')">Editar</button>
                <button type="button" class="danger-button" onclick="deleteAdminProduct('${escapeHtml(product.id)}')">Remover</button>
            </div>
        </article>
    `).join("");
}

function getAdminProductFormPayload() {
    return {
        type: document.getElementById("adminProductType")?.value || "service",
        category: document.getElementById("adminProductCategory")?.value?.trim() || "",
        name: document.getElementById("adminProductName")?.value?.trim() || "",
        price: Number(document.getElementById("adminProductPrice")?.value || 0),
        duration: document.getElementById("adminProductDuration")?.value?.trim() || "",
        description: document.getElementById("adminProductDescription")?.value?.trim() || "",
        details: document.getElementById("adminProductDetails")?.value || "",
        active: Boolean(document.getElementById("adminProductActive")?.checked)
    };
}

function resetProductForm() {
    const form = document.getElementById("productForm");
    const title = document.getElementById("productFormTitle");
    const productIdInput = document.getElementById("adminProductId");
    const activeInput = document.getElementById("adminProductActive");

    if (form) form.reset();
    if (title) title.textContent = "Adicionar produto";
    if (productIdInput) productIdInput.value = "";
    if (activeInput) activeInput.checked = true;
    setAdminMessage("");
}

function editAdminProduct(productId) {
    const product = adminProducts.find((item) => item.id === productId);
    if (!product) return;

    const setValue = (id, value) => {
        const input = document.getElementById(id);
        if (input) input.value = value ?? "";
    };

    setValue("adminProductId", product.id);
    setValue("adminProductType", product.type || "service");
    setValue("adminProductCategory", product.category || "");
    setValue("adminProductName", product.name || "");
    setValue("adminProductPrice", Number(product.price || 0));
    setValue("adminProductDuration", product.duration || "");
    setValue("adminProductDescription", product.description || "");
    setValue("adminProductDetails", Array.isArray(product.details) ? product.details.join("\n") : "");

    const activeInput = document.getElementById("adminProductActive");
    const title = document.getElementById("productFormTitle");
    if (activeInput) activeInput.checked = product.active !== false;
    if (title) title.textContent = "Editar produto";

    document.getElementById("productForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveAdminProduct(event) {
    event.preventDefault();
    setAdminMessage("");

    const productId = document.getElementById("adminProductId")?.value || "";
    const payload = getAdminProductFormPayload();
    const method = productId ? "PATCH" : "POST";
    const url = productId ? `/api/admin/products/${encodeURIComponent(productId)}` : "/api/admin/products";

    try {
        const response = await fetch(url, {
            method,
            headers: getAuthHeaders({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel salvar o produto.");
        }

        resetProductForm();
        await loadAdminProducts();
        setAdminMessage("Produto salvo. O site ja usa esse catalogo.", false);
    } catch (error) {
        setAdminMessage(error.message || "Falha ao salvar produto.", true);
    }
}

async function deleteAdminProduct(productId) {
    const product = adminProducts.find((item) => item.id === productId);
    if (!product) return;

    const confirmed = window.confirm(`Remover "${product.name}" do site?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel remover o produto.");
        }

        resetProductForm();
        await loadAdminProducts();
        setAdminMessage("Produto removido do site.", false);
    } catch (error) {
        setAdminMessage(error.message || "Falha ao remover produto.", true);
    }
}

async function initAdminPage() {
    if (!document.getElementById("adminApp")) return;

    const loginForm = document.getElementById("adminLoginForm");
    const productForm = document.getElementById("productForm");
    const clearButton = document.getElementById("clearProductFormButton");
    const refreshButton = document.getElementById("refreshAdminProductsButton");
    const logoutButton = document.getElementById("adminLogoutButton");

    if (loginForm) loginForm.addEventListener("submit", loginAdmin);
    if (productForm) productForm.addEventListener("submit", saveAdminProduct);
    if (clearButton) clearButton.addEventListener("click", resetProductForm);
    if (refreshButton) refreshButton.addEventListener("click", loadAdminProducts);
    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            await logoutAccount();
            showAdminLogin();
        });
    }

    if (authToken) {
        await refreshAuthState();
    }

    if (authUser?.isAdmin) {
        await loadAdminProducts();
    } else {
        showAdminLogin();
    }
}

// ========================
// CONFIRMACAO
// ========================
document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("checkoutForm");
    const hasCatalog = document.getElementById("services") || document.getElementById("customPackageModal");

    if (hasCatalog) {
        await loadProducts();
    }

    bindCustomPackageControls();
    bindAccountForms();
    await refreshAuthState();
    await initAdminPage();

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

            const booking = getCheckoutBooking();

            try {
                resetEmbeddedPayment();
                setPaymentBrickMessage("Preparando pagamento...");
                const data = await createCheckoutPreference(booking);
                await renderEmbeddedPayment(data, booking);
                document.getElementById("embeddedPaymentSection")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            } catch (error) {
                console.error(error);
                setPaymentBrickMessage(error.message || "Erro no pagamento", true);
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

    const mercadoPagoAccountButton = document.getElementById("mercadoPagoAccountButton");
    if (mercadoPagoAccountButton) {
        mercadoPagoAccountButton.addEventListener("click", payWithMercadoPagoAccount);
    }
});
