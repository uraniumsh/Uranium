// ==========================================
// 1. CONFIGURACIÓN FIREBASE Y TELEGRAM
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyB6Jj3SLC5I0seRbGvXXAHau0nWRnsj98U",
    authDomain: "uraniumsh.firebaseapp.com",
    projectId: "uraniumsh",
    storageBucket: "uraniumsh.firebasestorage.app",
    messagingSenderId: "401612582595",
    appId: "1:401612582595:web:fa9611083116e7038dfc76"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const TELEGRAM_BOT_TOKEN = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ";
const TELEGRAM_ADMIN_ID = "7056557759";

function sendTelegramNotification(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_ID, text: message, parse_mode: 'Markdown' })
    }).catch(err => console.error("Error Telegram:", err));
}

// ==========================================
// 2. VARIABLES DE ESTADO GLOBALES
// ==========================================
let products = [];
let categories = [];
let cart = {};
let cartCooldowns = {};
let currentUser = null;
let isAdmin = false;
let myUserId = localStorage.getItem('u_id');
let currentImg = "";
let editingId = null;
let currentNequiDest = "3137074357";
let subAdmins = JSON.parse(localStorage.getItem('u_subadmins')) || [];

// ==========================================
// 3. INICIALIZACIÓN DE SESIÓN (ID 170125)
// ==========================================
async function initSession() {
    // Si no hay ID local, generamos uno o asignamos el 170125 si es el primer usuario
    if (!myUserId) {
        const usersSnap = await db.collection("usuarios").limit(1).get();
        if (usersSnap.empty) {
            myUserId = "170125"; // El Dios de la página
            localStorage.setItem('u_admin', 'true');
        } else {
            myUserId = Math.floor(10000 + Math.random() * 90000).toString();
        }
        localStorage.setItem('u_id', myUserId);
    }

    const userRef = db.collection("usuarios").doc(myUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        const userData = {
            role: myUserId === "170125" ? 'superadmin' : 'user',
            balance: 0,
            registered: false,
            username: '',
            name: '',
            id: myUserId
        };
        await userRef.set(userData);
        currentUser = userData;
    } else {
        currentUser = userDoc.data();
    }

    isAdmin = currentUser.role === 'superadmin' || currentUser.role === 'admin';
    if (isAdmin) activateAdminUI();

    updateProfileUI();
    escucharDatos(); // Inicia la conexión en tiempo real
}

// ==========================================
// 4. ESCUCHADORES EN TIEMPO REAL (FIREBASE)
// ==========================================
function escucharDatos() {
    // Escuchar Productos
    db.collection("productos").onSnapshot(snap => {
        products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderGrid();
    });

    // Escuchar Categorías
    db.collection("categorias").onSnapshot(snap => {
        categories = [];
        snap.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
        
        // Si no hay categorías, inyectamos unas por defecto a Firebase
        if(categories.length === 0) {
            const defaultCats = ['NETFLIX', 'DISNEY+', 'HBO MAX', 'PRIME VIDEO', 'IPTV'];
            defaultCats.forEach(c => db.collection("categorias").add({ name: c }));
        } else {
            renderAll();
        }
    });

    // Escuchar cambios en mi propio perfil (Ej: si te recargan saldo por Firebase)
    db.collection("usuarios").doc(myUserId).onSnapshot(doc => {
        if (doc.exists) {
            currentUser = doc.data();
            updateProfileUI();
        }
    });
}

// ==========================================
// 5. UTILIDADES UI (MODALES, TOASTS, THEME)
// ==========================================
function showToast(msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

if(localStorage.getItem('u_dark') === 'true') document.body.classList.add('dark-mode');
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('u_dark', document.body.classList.contains('dark-mode'));
}

function openModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.remove('hidden'); 
}
function closeModal(id) {
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.add('closing');
    setTimeout(() => { el.classList.remove('closing'); el.classList.add('hidden'); }, 200);
}
function showView(view) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    const v = document.getElementById(`view-${view}`);
    if(v) v.classList.remove('hidden');
}

// Iniciar aplicación al cargar
window.onload = initSession;

// ==========================================
// 6. LOGIN Y ADMINISTRACIÓN
// ==========================================
async function handleLogin() {
    const em = document.getElementById('l-email').value;
    const pa = document.getElementById('l-pass').value;
    
    // Validar Súper Admin (Juan Rivera)
    if(em === 'juanrivera@urm.co' && pa === '1234') {
        myUserId = "170125";
        localStorage.setItem('u_id', myUserId);
        
        const userRef = db.collection("usuarios").doc(myUserId);
        const userDoc = await userRef.get();
        
        if(!userDoc.exists) {
            const newData = { role: 'superadmin', balance: 0, registered: true, username: 'juanrivera', name: 'JUAN RIVERA', id: myUserId };
            await userRef.set(newData);
            currentUser = newData;
        } else {
            await userRef.update({ role: 'superadmin' });
            currentUser = userDoc.data();
            currentUser.role = 'superadmin';
        }
        
        isAdmin = true; localStorage.setItem('u_admin', 'true');
        activateAdminUI(); closeModal('modal-settings'); showToast("MODO SÚPER ADMIN ACTIVO"); 
        updateProfileUI(); 
        escucharDatos(); // Reconectar
        return;
    }

    // Validar Sub-Admins
    let isValidSub = subAdmins.some(a => a.email === em && a.pass === pa);
    if(isValidSub) {
        isAdmin = true; localStorage.setItem('u_admin', 'true');
        await db.collection("usuarios").doc(myUserId).update({ role: 'admin' });
        currentUser.role = 'admin';
        activateAdminUI(); closeModal('modal-settings'); showToast("MODO ADMIN ACTIVO");
    } else {
        showToast("CREDENCIALES INVÁLIDAS");
    }
}

function activateAdminUI() {
    const adminBar = document.getElementById('admin-bar');
    const adminSidebar = document.getElementById('admin-sidebar');
    const btnLogin = document.getElementById('btn-login-header');
    const btnLogout = document.getElementById('btn-logout-header');
    const roleBadge = document.getElementById('admin-role-badge');

    if(adminBar) adminBar.classList.remove('hidden');
    if(adminSidebar) adminSidebar.classList.remove('hidden');
    if(btnLogin) btnLogin.classList.add('hidden');
    if(btnLogout) btnLogout.classList.remove('hidden');
    
    // Ocultar caja de login si el modal se abre
    const loginBox = document.getElementById('login-box');
    const logoutBox = document.getElementById('logout-box');
    if(loginBox) loginBox.classList.add('hidden');
    if(logoutBox) logoutBox.classList.remove('hidden');

    if(roleBadge && currentUser) {
        roleBadge.innerText = currentUser.role === 'superadmin' ? "SÚPER ADMIN (170125)" : "ADMINISTRADOR";
    }
}

async function handleLogout() {
    isAdmin = false; localStorage.setItem('u_admin', 'false');
    await db.collection("usuarios").doc(myUserId).update({ role: 'user' });
    currentUser.role = 'user';
    
    document.getElementById('admin-bar').classList.add('hidden');
    document.getElementById('admin-sidebar').classList.add('hidden');
    document.getElementById('btn-login-header').classList.remove('hidden');
    document.getElementById('btn-logout-header').classList.add('hidden');
    
    const loginBox = document.getElementById('login-box');
    const logoutBox = document.getElementById('logout-box');
    if(loginBox) loginBox.classList.remove('hidden');
    if(logoutBox) logoutBox.classList.add('hidden');

    showView('products'); renderGrid(); showToast("SESIÓN CERRADA");
}

function addSubAdmin() {
    if(currentUser.role !== "superadmin") return showToast("SOLO SÚPER ADMIN PUEDE GESTIONAR ESTO");
    const id = document.getElementById('new-admin-id').value;
    const email = document.getElementById('new-admin-email').value;
    const pass = document.getElementById('new-admin-pass').value;
    if(!id || !email || !pass) return showToast("DATOS INCOMPLETOS");
    subAdmins.push({ id, email, pass });
    localStorage.setItem('u_subadmins', JSON.stringify(subAdmins));
    showToast("ADMIN AGREGADO CON ÉXITO"); closeModal('modal-manage-admins');
}

// ==========================================
// 7. PERFIL Y BILLETERA (CON FIREBASE)
// ==========================================
function updateProfileUI() {
    const pId = document.getElementById('profile-id');
    const pName = document.getElementById('profile-name-display');
    const wBal = document.getElementById('wallet-balance');
    const rSec = document.getElementById('register-section');

    if(pId) pId.innerText = myUserId;
    if(pName) pName.innerText = currentUser.registered ? currentUser.name : "INVITADO";
    if(wBal) wBal.innerText = `$${currentUser.balance.toLocaleString()}`;
    if(currentUser.registered && rSec) rSec.classList.add('hidden');
}

async function registerUser() {
    const user = document.getElementById('reg-username').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    if(!user || !name) return showToast("LLENA TODOS LOS DATOS");
    
    // Verificar si existe el username en Firebase
    const usersRef = db.collection("usuarios");
    const snapshot = await usersRef.where("username", "==", user).get();
    if (!snapshot.empty) return showToast("EL USUARIO YA EXISTE");

    await usersRef.doc(myUserId).update({
        username: user,
        name: name,
        registered: true,
        balance: firebase.firestore.FieldValue.increment(5000)
    });

    showToast("¡REGISTRO EXITOSO! +$5000 AÑADIDOS A LA BILLETERA");
}

async function addBalanceToUser() {
    if(!isAdmin) return;
    const id = document.getElementById('bal-user-id').value;
    const amt = parseInt(document.getElementById('bal-amount').value);
    
    if(!id || isNaN(amt)) return showToast("DATOS INVÁLIDOS");

    const userRef = db.collection("usuarios").doc(id);
    const doc = await userRef.get();
    if(!doc.exists) return showToast("USUARIO NO ENCONTRADO EN LA BASE DE DATOS");

    await userRef.update({
        balance: firebase.firestore.FieldValue.increment(amt)
    });
    
    showToast(`$${amt} RECARGADOS AL ID #${id}`); 
    closeModal('modal-add-balance');
}

// ==========================================
// 8. PRODUCTOS Y CATEGORÍAS (FIREBASE)
// ==========================================
async function saveNewCategory() {
    const name = document.getElementById('new-cat-name').value;
    if(name) {
        await db.collection("categorias").add({ name: name.toUpperCase() });
        closeModal('modal-add-cat'); showToast("CATEGORÍA CREADA");
        document.getElementById('new-cat-name').value = "";
    }
}

function openPublishModal(id = null) {
    editingId = id;
    if(id) {
        document.getElementById('pub-title').innerText = "EDITAR PRODUCTO";
        const p = products.find(prod => prod.id === id);
        if(!p) return;
        
        document.getElementById('p-name').value = p.name || "";
        document.getElementById('p-short').value = p.short || "";
        document.getElementById('p-price').value = p.price || "";
        document.getElementById('p-cat-select').value = p.catId || "";
        document.getElementById('p-desc').value = p.desc || "";
        document.getElementById('p-contact').value = p.contact || "";
        document.getElementById('p-wa').value = p.wa || "";
        document.getElementById('p-nequi-dest').value = p.nequiDest || "";
        document.getElementById('p-pinned').checked = p.pinned || false;
        
        currentImg = p.img || "";
        if(currentImg) {
            document.getElementById('file-preview').src = currentImg;
            document.getElementById('file-preview').classList.remove('hidden');
            document.getElementById('upload-label').classList.add('hidden');
        }
    } else {
        document.getElementById('pub-title').innerText = "NUEVA PUBLICACIÓN";
        resetForm();
    }
    openModal('modal-publish');
}

function previewImage() {
    const file = document.getElementById('file-input').files[0];
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            currentImg = reader.result;
            document.getElementById('file-preview').src = reader.result;
            document.getElementById('file-preview').classList.remove('hidden');
            document.getElementById('upload-label').classList.add('hidden');
        }; 
        reader.readAsDataURL(file);
    }
}

async function handleSaveProduct() {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    
    if(!currentImg || !name || !price) return showToast("FOTO, NOMBRE Y PRECIO OBLIGATORIOS");

    const data = {
        name, 
        price: parseFloat(price),
        short: document.getElementById('p-short').value,
        desc: document.getElementById('p-desc').value,
        contact: document.getElementById('p-contact').value || "3137074357",
        wa: document.getElementById('p-wa').value || `Hola URANIUM, me interesa ${name}`,
        nequiDest: document.getElementById('p-nequi-dest').value || "3137074357",
        catId: document.getElementById('p-cat-select').value,
        pinned: document.getElementById('p-pinned').checked, 
        img: currentImg
    };

    if(editingId) {
        await db.collection("productos").doc(editingId).update(data);
    } else {
        // Inicializar social stats en productos nuevos
        data.reactions = {};
        data.comments = [];
        await db.collection("productos").add(data);
    }

    closeModal('modal-publish'); 
    showToast(editingId ? "PRODUCTO ACTUALIZADO" : "PRODUCTO PUBLICADO");
}

function resetForm() {
    document.querySelectorAll('#modal-publish input[type="text"], #modal-publish input[type="number"], #modal-publish textarea').forEach(i => i.value = "");
    const cb = document.getElementById('p-pinned'); if(cb) cb.checked = false;
    const fp = document.getElementById('file-preview'); if(fp) fp.classList.add('hidden');
    const ul = document.getElementById('upload-label'); if(ul) ul.classList.remove('hidden');
    currentImg = "";
}

// ==========================================
// 9. RENDERIZADO (GRID Y CATEGORÍAS)
// ==========================================
function renderGrid(catId = 'all') {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    let filtered = products.filter(p => catId === 'all' || p.catId === catId);
    filtered.sort((a, b) => (b.pinned === true) - (a.pinned === true));

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => openDetail(p.id);
        
        card.innerHTML = `
            ${p.pinned ? `<div class="pin-badge">⭐ FIJADO</div>` : ''}
            <div class="card-img"><img src="${p.img}"></div>
            <div class="card-info">
                <h4>${p.name}</h4>
                ${isAdmin ? `<button class="btn-edit-card" onclick="event.stopPropagation(); openPublishModal('${p.id}')">EDITAR</button>` : ''}
                <p>$${parseFloat(p.price).toLocaleString()}</p>
                <div class="slogan-box">${p.short || ''}</div>
                <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart('${p.id}')">AÑADIR AL CARRITO 🛒</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderAll() {
    const navPC = document.getElementById('nav-cats');
    const navMob = document.getElementById('mobile-nav-cats');
    const sel = document.getElementById('p-cat-select');
    
    if(navPC) {
        navPC.innerHTML = `<a href="#" onclick="renderGrid('all')">VER TODAS</a>` + 
                          categories.map(c => `<a href="#" onclick="renderGrid('${c.id}')">${c.name}</a>`).join('');
    }
    if(navMob) {
        navMob.innerHTML = `<button onclick="renderGrid('all')">TODAS</button>` + 
                           categories.map(c => `<button onclick="renderGrid('${c.id}')">${c.name}</button>`).join('');
    }
    if(sel) {
        sel.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    renderGrid();
}

// ==========================================
// 10. PUBLICACIÓN Y EDICIÓN DE PRODUCTOS
// ==========================================
function openPublishModal(id = null) {
    editingId = id;
    if(id) {
        document.getElementById('pub-title').innerText = "EDITAR PRODUCTO";
        const p = products.find(prod => prod.id === id);
        if(!p) return;
        
        document.getElementById('p-name').value = p.name || "";
        document.getElementById('p-short').value = p.short || "";
        document.getElementById('p-price').value = p.price || "";
        document.getElementById('p-cat-select').value = p.catId || "";
        document.getElementById('p-desc').value = p.desc || "";
        document.getElementById('p-contact').value = p.contact || "";
        document.getElementById('p-wa').value = p.wa || "";
        document.getElementById('p-nequi-dest').value = p.nequiDest || "";
        document.getElementById('p-pinned').checked = p.pinned || false;
        
        currentImg = p.img || "";
        if(currentImg) {
            document.getElementById('file-preview').src = currentImg;
            document.getElementById('file-preview').classList.remove('hidden');
            document.getElementById('upload-label').classList.add('hidden');
        }
    } else {
        document.getElementById('pub-title').innerText = "NUEVA PUBLICACIÓN";
        resetForm();
    }
    openModal('modal-publish');
}

function previewImage() {
    const file = document.getElementById('file-input').files[0];
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            currentImg = reader.result;
            document.getElementById('file-preview').src = reader.result;
            document.getElementById('file-preview').classList.remove('hidden');
            document.getElementById('upload-label').classList.add('hidden');
        }; 
        reader.readAsDataURL(file);
    }
}

async function handleSaveProduct() {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    
    if(!currentImg || !name || !price) return showToast("FOTO, NOMBRE Y PRECIO OBLIGATORIOS");

    const existingP = editingId ? products.find(p => p.id === editingId) : {};
    
    const data = {
        name, 
        price: parseFloat(price),
        short: document.getElementById('p-short').value,
        desc: document.getElementById('p-desc').value,
        contact: document.getElementById('p-contact').value || "3137074357",
        wa: document.getElementById('p-wa').value || `Hola URANIUM, me interesa ${name}`,
        nequiDest: document.getElementById('p-nequi-dest').value || "3137074357",
        catId: document.getElementById('p-cat-select').value,
        pinned: document.getElementById('p-pinned').checked, 
        img: currentImg,
        reactions: existingP.reactions || {}, 
        comments: existingP.comments || []
    };

    if(editingId) {
        const i = products.findIndex(p => p.id === editingId);
        if(i > -1) products[i] = data;
        await db.collection("productos").doc(editingId.toString()).update(data);
    } else {
        await db.collection("productos").add(data);
    }

    closeModal('modal-publish'); 
    showToast(editingId ? "PRODUCTO ACTUALIZADO" : "PRODUCTO PUBLICADO"); 
}

// ==========================================
// 11. RENDERIZADO DE LA INTERFAZ
// ==========================================
function renderGrid(catId = 'all') {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    let filtered = products.filter(p => catId === 'all' || p.catId === catId);
    filtered.sort((a, b) => (b.pinned === true) - (a.pinned === true));

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => openDetail(p.id);
        
        card.innerHTML = `
            ${p.pinned ? `<div class="pin-badge">⭐ FIJADO</div>` : ''}
            <div class="card-img"><img src="${p.img}"></div>
            <div class="card-info">
                <h4>${p.name}</h4>
                ${isAdmin ? `<button class="btn-edit-card" onclick="event.stopPropagation(); openPublishModal('${p.id}')">EDITAR</button>` : ''}
                <p>$${parseFloat(p.price).toLocaleString()}</p>
                <div class="slogan-box">${p.short || ''}</div>
                <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart('${p.id}')">AÑADIR AL CARRITO 🛒</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderAll() {
    const navPC = document.getElementById('nav-cats');
    const navMob = document.getElementById('mobile-nav-cats');
    const sel = document.getElementById('p-cat-select');
    
    if(navPC) {
        navPC.innerHTML = `<a href="#" onclick="renderGrid('all')">VER TODAS</a>` + 
                          categories.map(c => `<a href="#" onclick="renderGrid('${c.id}')">${c.name}</a>`).join('');
    }
    
    if(navMob) {
        navMob.innerHTML = `<button onclick="renderGrid('all')">TODAS</button>` + 
                           categories.map(c => `<button onclick="renderGrid('${c.id}')">${c.name}</button>`).join('');
    }
    
    if(sel) {
        sel.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    renderGrid();
}

// ==========================================
// 12. DETALLE DE PRODUCTO Y SISTEMA SOCIAL
// ==========================================
function openDetail(id) {
    const p = products.find(prod => prod.id === id);
    if(!p) return;
    const body = document.getElementById('detail-body');
    
    let likes = 0, dislikes = 0;
    let myReaction = p.reactions ? p.reactions[myUserId] : null;
    
    if(p.reactions) {
        for(let user in p.reactions) {
            if(p.reactions[user] === 'like') likes++;
            if(p.reactions[user] === 'dislike') dislikes++;
        }
    }

    let commentsHTML = (p.comments || []).map(c => `<div class="comment-item"><strong>#${c.userId}:</strong> ${c.text}</div>`).join('');

    body.innerHTML = `
        <div class="detail-layout">
            <div class="detail-img-container"><img src="${p.img}"></div>
            <div class="detail-info">
                <h2>${p.name}</h2>
                <p style="margin:10px 0; font-size:12px; flex-grow:1; text-transform:none;">${p.desc || ''}</p>
                <h3>PRECIO: $${parseFloat(p.price).toLocaleString()}</h3>
                
                <div class="social-bar">
                    <button onclick="handleReaction('${p.id}', 'like')" style="color: ${myReaction==='like' ? 'var(--border-color)' : 'inherit'}">
                        👍 <span>${likes}</span>
                    </button>
                    <button onclick="handleReaction('${p.id}', 'dislike')" style="color: ${myReaction==='dislike' ? 'var(--border-color)' : 'inherit'}">
                        👎 <span>${dislikes}</span>
                    </button>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button class="btn-primary" onclick="addToCart('${p.id}'); closeModal('modal-detail')">AÑADIR AL CARRITO 🛒</button>
                    <button class="btn-wa" onclick="window.open('https://wa.me/57${p.contact || '3137074357'}?text=${encodeURIComponent(p.wa || 'Hola')}')">COMPRA YA EN WHATSAPP</button>
                    <button class="btn-nequi" onclick="buyDirectNequi('${p.id}')">PAGA CON NEQUI</button>
                </div>

                <div class="comments-section">
                    <h4 style="margin-bottom:5px;">COMENTARIOS</h4>
                    <div style="display:flex; gap:5px; margin-bottom:10px;">
                        <input type="text" id="com-text-${p.id}" placeholder="Escribe un comentario..." style="margin:0; padding:8px; font-size:10px;">
                        <button class="btn-primary" style="width:auto; padding:8px;" onclick="addComment('${p.id}')">ENVIAR</button>
                    </div>
                    <div style="max-height:120px; overflow-y:auto;">${commentsHTML}</div>
                </div>
            </div>
        </div>
    `; 
    openModal('modal-detail');
}

async function handleReaction(id, type) {
    const ref = db.collection("productos").doc(id.toString());
    const doc = await ref.get();
    let reactions = doc.data().reactions || {};

    // Toggle para quitar la reacción
    if(reactions[myUserId] === type) {
        delete reactions[myUserId];
    } else {
        reactions[myUserId] = type;
    }

    await ref.update({ reactions });
    // openDetail(id) se llamará automáticamente gracias a escucharDatos() (onSnapshot)
}

async function addComment(id) {
    const input = document.getElementById(`com-text-${id}`);
    if(!input.value) return showToast("ESCRIBE ALGO");
    
    await db.collection("productos").doc(id.toString()).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            userId: myUserId,
            text: input.value,
            timestamp: new Date().toISOString()
        })
    });
    
    input.value = "";
    showToast("COMENTARIO ENVIADO");
}

// ==========================================
// 13. LÓGICA DEL CARRITO (Cooldown y Borrado)
// ==========================================
function addToCart(id) {
    if(cartCooldowns[id] && (Date.now() - cartCooldowns[id] < 1000)) {
        return showToast("ESPERA 1 SEGUNDO...");
    }
    cartCooldowns[id] = Date.now();
    
    if(cart[id]) {
        cart[id].qty++;
    } else {
        cart[id] = {...products.find(p => p.id === id), qty: 1};
    }
    
    updateCartUI(); 
    showToast("AÑADIDO AL CARRITO 🛒");
}

function removeFromCart(id) { 
    delete cart[id]; 
    updateCartUI(); 
}

function updateCartUI() {
    const list = document.getElementById('cart-list'); 
    let total = 0, count = 0;
    
    list.innerHTML = Object.values(cart).map(p => {
        total += (p.price * p.qty); 
        count += p.qty;
        return `
        <div style="border:2px solid var(--border-color); padding:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
            <div><strong>${p.name} (x${p.qty})</strong><br>$${(p.price * p.qty).toLocaleString()}</div>
            <button onclick="removeFromCart('${p.id}')" style="background:red; color:white; border:none; padding:5px 10px; cursor:pointer; font-weight:bold;">X</button>
        </div>`;
    }).join('');
    
    document.getElementById('cart-count').innerText = count; 
    document.getElementById('cart-total').innerText = `$${total.toLocaleString()}`; 
    document.getElementById('pay-val').innerText = `$${total.toLocaleString()}`;
}

// ==========================================
// 14. SISTEMA DE PAGOS, TELEGRAM Y ÓRDENES
// ==========================================
async function payWithWallet() {
    const total = Object.values(cart).reduce((sum, p) => sum + (p.price * p.qty), 0);
    if(total === 0) return showToast("CARRITO VACÍO");
    
    if(currentUser.balance >= total) {
        // Descuento directo en Firebase
        await db.collection("usuarios").doc(myUserId).update({
            balance: firebase.firestore.FieldValue.increment(-total)
        });
        
        const token = "ORD-" + Math.random().toString(36).substr(2,5).toUpperCase();
        let details = Object.values(cart).map(p => `${p.qty}x ${p.name}`).join(', ');
        
        addLog(`TOKEN: ${token}`, `WALLET: ${details} | Total: $${total}`);
        
        let tgMsg = `🟢 *COMPRA FINALIZADA (BILLETERA)* 🟢\n\n`;
        tgMsg += `*Token:* ${token}\n`;
        tgMsg += `*ID Usuario:* #${myUserId}\n`;
        tgMsg += `*Servicios:* ${details}\n`;
        tgMsg += `*Total Pagado:* $${total}`;
        sendTelegramNotification(tgMsg);

        cart = {}; 
        updateCartUI(); 
        closeModal('modal-cart'); 
        showToast("¡COMPRA EXITOSA CON SALDO!");
    } else {
        showToast("SALDO INSUFICIENTE");
    }
}

function goToPayment() {
    if(Object.keys(cart).length === 0) return showToast("CARRITO VACÍO");
    currentNequiDest = "3137074357"; 
    closeModal('modal-cart'); 
    openModal('modal-nequi');
}

function buyDirectNequi(id) {
    const p = products.find(prod => prod.id === id); 
    if(!p) return;
    
    cart = {}; 
    addToCart(id); 
    currentNequiDest = p.nequiDest || "3137074357"; 
    
    closeModal('modal-detail'); 
    openModal('modal-nequi');
}

function processPayment() {
    const name = document.getElementById('pay-name').value;
    const phone = document.getElementById('pay-phone').value;
    
    if(!name || phone.length < 10) return showToast("INGRESA UN NOMBRE Y NÚMERO VÁLIDOS");

    const token = "ORD-" + Math.random().toString(36).substr(2,5).toUpperCase();
    let details = Object.values(cart).map(p => `${p.qty}x ${p.name}`).join(', ');
    let totalStr = document.getElementById('cart-total').innerText;

    addLog(`TOKEN: ${token}`, `NEQUI PENDIENTE: ${details} | Total: ${totalStr}`);

    let tgMsg = `🚨 *NUEVA ORDEN GENERADA (NEQUI)* 🚨\n\n`;
    tgMsg += `*Token:* ${token}\n`;
    tgMsg += `*ID Usuario:* #${myUserId}\n`;
    tgMsg += `*Cliente:* ${name} (${phone})\n`;
    tgMsg += `*Servicios:* ${details}\n`;
    tgMsg += `*Valor a Cobrar:* ${totalStr}`;
    sendTelegramNotification(tgMsg);

    document.getElementById('nequi-form').classList.add('hidden');
    document.getElementById('nequi-processing').classList.remove('hidden');

    setTimeout(() => {
        let waMsg = `Hola URANIUM, mi orden generada es el token de seguridad: *${token}*`;
        showToast(`TOKEN DE SEGURIDAD CREADO: ${token}`);
        window.open(`https://wa.me/57${currentNequiDest}?text=${waMsg}`, '_blank');
        
        cart = {}; 
        updateCartUI(); 
        closeModal('modal-nequi');
        
        document.getElementById('nequi-form').classList.remove('hidden');
        document.getElementById('nequi-processing').classList.add('hidden');
    }, 2500); 
}

// ==========================================
// 15. UTILIDADES Y RESET
// ==========================================
function addLog(action, item) {
    const log = document.getElementById('log-table');
    if(log) {
        log.innerHTML = `<tr><td>${new Date().toLocaleTimeString()}</td><td>${action}</td><td>${item}</td></tr>` + log.innerHTML;
    }
}

function resetForm() {
    document.querySelectorAll('#modal-publish input[type="text"], #modal-publish input[type="number"], #modal-publish textarea').forEach(i => i.value = "");
    const cb = document.getElementById('p-pinned'); if(cb) cb.checked = false;
    const fp = document.getElementById('file-preview'); if(fp) fp.classList.add('hidden');
    const ul = document.getElementById('upload-label'); if(ul) ul.classList.remove('hidden');
    currentImg = "";
}
