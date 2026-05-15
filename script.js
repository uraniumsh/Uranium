// ==========================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyB6Jj3SLC5I0seRbGvXXAHau0nWRnsj98U",
    authDomain: "uraniumsh.firebaseapp.com",
    projectId: "uraniumsh",
    storageBucket: "uraniumsh.firebasestorage.app",
    messagingSenderId: "401612582595",
    appId: "1:401612582595:web:fa9611083116e7038dfc76"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const TELEGRAM_BOT_TOKEN = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ";
const TELEGRAM_ADMIN_ID = "7056557759";

// Variables de Estado
let products = [];
let categories = [];
let cart = {};
let currentUser = null;
let isAdmin = false;
let myUserId = localStorage.getItem('u_id');
let currentImg = "";
let editingId = null;

// ==========================================
// 2. SISTEMA DE IDENTIDAD Y ADMIN (170125)
// ==========================================

async function initSession() {
    // Si no tiene ID, lo generamos. Si es el primero de la historia, es 170125
    if (!myUserId) {
        const usersSnap = await db.collection("usuarios").limit(1).get();
        if (usersSnap.empty) {
            myUserId = "170125";
        } else {
            myUserId = Math.floor(10000 + Math.random() * 90000).toString();
        }
        localStorage.setItem('u_id', myUserId);
    }

    // Sincronizar con Firestore
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

    // Verificar si es Admin o Sub-Admin (Rol guardado en Firestore)
    isAdmin = currentUser.role === 'superadmin' || currentUser.role === 'admin';
    if (isAdmin) activateAdminUI();

    updateProfileUI();
    escucharDatos();
}

// ==========================================
// 3. ESCUCHADORES EN TIEMPO REAL (Firestore)
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
        renderAll();
    });

    // Escuchar mi propio usuario (Para saldo en vivo)
    db.collection("usuarios").doc(myUserId).onSnapshot(doc => {
        if (doc.exists) {
            currentUser = doc.data();
            updateProfileUI();
        }
    });
}

// ==========================================
// 4. FUNCIONES DE PRODUCTOS (u_db)
// ==========================================

async function handleSaveProduct() {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;

    if (!currentImg || !name || !price) return showToast("FOTO, NOMBRE Y PRECIO OBLIGATORIOS");

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
        reactions: {},
        comments: []
    };

    if (editingId) {
        await db.collection("productos").doc(editingId.toString()).update(data);
    } else {
        await db.collection("productos").add(data);
    }

    closeModal('modal-publish');
    showToast(editingId ? "PRODUCTO ACTUALIZADO" : "PRODUCTO PUBLICADO");
}

// Reacciones y Comentarios
async function handleReaction(id, type) {
    const ref = db.collection("productos").doc(id.toString());
    const doc = await ref.get();
    let reactions = doc.data().reactions || {};

    if (reactions[myUserId] === type) delete reactions[myUserId];
    else reactions[myUserId] = type;

    await ref.update({ reactions });
    openDetail(id); 
}

async function addComment(id) {
    const input = document.getElementById(`com-text-${id}`);
    if (!input.value) return showToast("ESCRIBE ALGO");

    await db.collection("productos").doc(id.toString()).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            userId: myUserId,
            text: input.value,
            timestamp: new Date().toISOString()
        })
    });
    input.value = "";
    openDetail(id);
}

// ==========================================
// 5. BILLETERA Y ADMIN
// ==========================================

async function registerUser() {
    const user = document.getElementById('reg-username').value.trim();
    const name = document.getElementById('reg-name').value.trim();

    if (!user || !name) return showToast("LLENA TODOS LOS DATOS");

    const userRef = db.collection("usuarios").doc(myUserId);
    await userRef.update({
        username: user,
        name: name,
        registered: true,
        balance: firebase.firestore.FieldValue.increment(5000)
    });

    showToast("¡REGISTRO EXITOSO! +$5000");
}

async function addBalanceToUser() {
    if (!isAdmin) return;
    const id = document.getElementById('bal-user-id').value;
    const amt = parseInt(document.getElementById('bal-amount').value);

    await db.collection("usuarios").doc(id).update({
        balance: firebase.firestore.FieldValue.increment(amt)
    });

    showToast(`$${amt} RECARGADOS AL ID #${id}`);
    closeModal('modal-add-balance');
}

// ==========================================
// 6. UI Y RENDERIZADO (Tus funciones originales)
// ==========================================

function renderGrid(catId = 'all') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
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

function updateProfileUI() {
    const pId = document.getElementById('profile-id');
    const pName = document.getElementById('profile-name-display');
    const wBal = document.getElementById('wallet-balance');
    const rSec = document.getElementById('register-section');

    if (pId) pId.innerText = myUserId;
    if (pName) pName.innerText = currentUser.registered ? currentUser.name : "INVITADO";
    if (wBal) wBal.innerText = `$${currentUser.balance.toLocaleString()}`;
    if (currentUser.registered && rSec) rSec.classList.add('hidden');
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Helpers de Modales
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('closing');
    setTimeout(() => { el.classList.remove('closing'); el.classList.add('hidden'); }, 200);
}

// Inicialización final
window.onload = initSession;
        
