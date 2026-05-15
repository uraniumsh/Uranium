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

// NUEVO: Enviar foto a Telegram
async function sendTelegramPhoto(file, caption) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const formData = new FormData();
    formData.append("chat_id", TELEGRAM_ADMIN_ID);
    formData.append("photo", file);
    formData.append("caption", caption);
    formData.append("parse_mode", "Markdown");

    try {
        await fetch(url, { method: "POST", body: formData });
    } catch (e) {
        console.error("Error sending photo", e);
    }
}

// ==========================================
// 2. VARIABLES GLOBALES
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

// Variables para el comprobante
let currentReceiptFile = null;
let currentReceiptContext = {}; 

// ==========================================
// 3. INICIALIZACIÓN Y PANTALLA DE BANEO
// ==========================================
async function initSession() {
    if (!myUserId) {
        const usersSnap = await db.collection("usuarios").limit(1).get();
        if (usersSnap.empty) {
            myUserId = "170125"; 
            localStorage.setItem('u_admin', 'true');
        } else {
            myUserId = Math.floor(10000 + Math.random() * 90000).toString();
        }
        localStorage.setItem('u_id', myUserId);
    }

    const userRef = db.collection("usuarios").doc(myUserId);
    const userDoc = await userRef.get();
    const rightNow = new Date().toISOString();

    if (!userDoc.exists) {
        const userData = {
            role: myUserId === "170125" ? 'superadmin' : 'user',
            balance: 0, registered: false, username: '', name: '',
            id: myUserId, banned: false, lastActive: rightNow 
        };
        await userRef.set(userData);
        currentUser = userData;
    } else {
        currentUser = userDoc.data();
        
        // 🔥 LA INMUNIDAD: Si eres el jefe (170125), nunca te muestra la pantalla negra
        if(currentUser.banned === true && myUserId !== "170125") {
            document.body.innerHTML = `
            <div style="background:black; color:red; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; font-family:monospace; padding: 20px;">
                <h1 style="font-size:80px; margin:0;">🚫</h1>
                <h2>CUENTA SUSPENDIDA</h2>
                <p>Tu acceso a URANIUM DIGITAL ha sido revocado.</p>
                <p style="font-size:10px; color:gray; margin-top:20px;">ID: #${myUserId}</p>
            </div>`;
            return; 
        }
        
        await userRef.update({ lastActive: rightNow });
    }

    isAdmin = currentUser.role === 'superadmin' || currentUser.role === 'admin';
    if (isAdmin) activateAdminUI();

    updateProfileUI();
    escucharDatos(); 
}

// ==========================================
// 4. ESCUCHADORES EN TIEMPO REAL
// ==========================================
function escucharDatos() {
    db.collection("productos").onSnapshot(snap => {
        products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderGrid();
    });

    db.collection("categorias").onSnapshot(snap => {
        categories = [];
        snap.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
        if(categories.length === 0) {
            const defaultCats = ['NETFLIX', 'DISNEY+', 'MAX', 'PRIME VIDEO', 'STAR+', 'CRUNCHYROLL', 'SPOTIFY', 'YOUTUBE PREMIUM', 'PARAMOUNT+', 'IPTV'];
            defaultCats.forEach(c => db.collection("categorias").add({ name: c }));
        } else {
            renderAll();
        }
    });

        db.collection("usuarios").doc(myUserId).onSnapshot(doc => {
        if (doc.exists) {
            currentUser = doc.data();
            updateProfileUI();
            // 🔥 LA INMUNIDAD: No te recarga la página si te intentan banear en vivo
            if(currentUser.banned === true && myUserId !== "170125") location.reload(); 
        }
    });


// ==========================================
// 5. UTILIDADES UI
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

window.onload = initSession;

// ==========================================
// 6. LOGIN, ADMINISTRACIÓN Y COMANDOS DEL BOT
// ==========================================
async function handleLogin() {
    const em = document.getElementById('l-email').value.trim().toLowerCase();
    const pa = document.getElementById('l-pass').value.trim();
    if(!em || !pa) return showToast("INGRESA DATOS");

    try {
        const saDoc = await db.collection("usuarios").doc("170125").get();
        if(saDoc.exists && saDoc.data().adminEmail.toLowerCase() === em && saDoc.data().adminPass === pa) {
            myUserId = "170125"; localStorage.setItem('u_id', myUserId);
            currentUser = saDoc.data(); isAdmin = true; localStorage.setItem('u_admin', 'true');
            activateAdminUI(); closeModal('modal-settings'); showToast("MODO SÚPER ADMIN ACTIVO"); 
            updateProfileUI(); escucharDatos(); return;
        }

        const adminsSnap = await db.collection("admins").where("email", "==", em).where("pass", "==", pa).get();
        if(!adminsSnap.empty) {
            const adminData = adminsSnap.docs[0].data();
            myUserId = adminData.id; localStorage.setItem('u_id', myUserId);
            isAdmin = true; localStorage.setItem('u_admin', 'true');
            await db.collection("usuarios").doc(myUserId).set({ role: 'admin' }, { merge: true });
            activateAdminUI(); closeModal('modal-settings'); showToast("MODO ADMIN ACTIVO");
            escucharDatos();
        } else { showToast("CREDENCIALES INVÁLIDAS"); }
    } catch (error) { showToast("ERROR AL INICIAR SESIÓN"); console.error(error); }
}

function activateAdminUI() {
    document.getElementById('admin-bar')?.classList.remove('hidden');
    document.getElementById('admin-sidebar')?.classList.remove('hidden');
    document.getElementById('btn-login-header')?.classList.add('hidden');
    document.getElementById('btn-logout-header')?.classList.remove('hidden');
    document.getElementById('login-box')?.classList.add('hidden');
    document.getElementById('logout-box')?.classList.remove('hidden');

    if(currentUser) {
        const badge = document.getElementById('admin-role-badge');
        if(badge) badge.innerText = currentUser.role === 'superadmin' ? "SÚPER ADMIN" : "ADMINISTRADOR";
        if(currentUser.role === 'superadmin') {
            document.getElementById('btn-security')?.classList.remove('hidden');
            document.getElementById('admin-list-container')?.classList.remove('hidden');
            cargarAdminsEnDashboard(); 
        }
        cargarUsuariosEnDashboard(); 
        iniciarBotTelegram(); 
    }
}

async function handleLogout() {
    isAdmin = false; localStorage.setItem('u_admin', 'false');
    
    document.getElementById('admin-bar')?.classList.add('hidden');
    document.getElementById('admin-sidebar')?.classList.add('hidden');
    document.getElementById('btn-login-header')?.classList.remove('hidden');
    document.getElementById('btn-logout-header')?.classList.add('hidden');
    document.getElementById('login-box')?.classList.remove('hidden');
    document.getElementById('logout-box')?.classList.add('hidden');
    document.getElementById('btn-security')?.classList.add('hidden');
    document.getElementById('admin-list-container')?.classList.add('hidden');

    showView('products'); renderGrid(); showToast("SESIÓN CERRADA");
    
    // APAGAMOS EL MOTOR DEL BOT SILENCIOSAMENTE SIN RECARGAR LA PÁGINA
    if (typeof botInterval !== 'undefined') {
        clearInterval(botInterval); 
        console.log("Motor del bot APAGADO 🛑");
    }
}

// === GESTIÓN DE USUARIOS Y BANEO EN PANTALLA ===
function cargarUsuariosEnDashboard() {
    const tbody = document.getElementById('users-table');
    if(!tbody) return;
    
    db.collection("usuarios").orderBy("lastActive", "desc").onSnapshot(snap => {
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            if(u.id === "170125") return; 
            
            const isBanned = u.banned === true;
            const date = u.lastActive ? new Date(u.lastActive).toLocaleString('es-CO', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Nunca';
            
            tbody.innerHTML += `
            <tr style="${isBanned ? 'opacity:0.5; background:#ff000020;' : ''}">
                <td><strong>#${u.id}</strong><br>${u.name || 'Invitado'}<br><span style="font-size:9px;">Acceso: ${date}</span></td>
                <td>$${(u.balance || 0).toLocaleString()}</td>
                <td>
                    ${isBanned 
                    ? `<span style="color:red; font-weight:bold;">BANEADO</span><br><button onclick="toggleBan('${u.id}', false)" style="background:green; color:white; border:none; padding:5px; margin-top:5px; cursor:pointer; font-size:10px;">DESBANEAR</button>`
                    : `<span style="color:green; font-weight:bold;">ACTIVO</span><br><button onclick="toggleBan('${u.id}', true)" style="background:red; color:white; border:none; padding:5px; margin-top:5px; cursor:pointer; font-size:10px;">BANEAR</button>`}
                </td>
            </tr>`;
        });
    });
}

async function toggleBan(id, status) {
    if(confirm(`¿Seguro que quieres ${status ? 'BANEAR' : 'DESBANEAR'} al usuario #${id}?`)) {
        await db.collection("usuarios").doc(id).update({ banned: status });
        showToast(`USUARIO ${status ? 'BANEADO 🚫' : 'DESBANEADO ✅'}`);
    }
}

// === MOTOR DEL BOT DE TELEGRAM ===
let telegramOffset = 0;
let botInterval; // Variable para atrapar y apagar el motor

function iniciarBotTelegram() {
    console.log("Motor del Bot de Telegram ENCENDIDO 🚀");
    
    botInterval = setInterval(async () => {
        if(!isAdmin) return; 
        try {
            const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${telegramOffset}`);
            const data = await res.json();
            if(data.ok && data.result.length > 0) {
                for(let update of data.result) {
                    telegramOffset = update.update_id + 1; 
                    
                    if(update.message && update.message.text) {
                        let text = update.message.text.trim();
                        let chatId = update.message.chat.id.toString();
                        
                        if(chatId !== TELEGRAM_ADMIN_ID) continue; 
                        
                        const args = text.split(" ");
                        const comando = args[0].toLowerCase();
                        const targetId = args[1];
                        const monto = args[2] ? parseInt(args[2]) : 0;

                        if(comando === "/recargar" && targetId && !isNaN(monto)) {
                            await db.collection("usuarios").doc(targetId).update({ balance: firebase.firestore.FieldValue.increment(monto) });
                            sendTelegramNotification(`✅ *$${monto.toLocaleString()}* recargados al usuario #${targetId} desde Telegram.`);
                            showToast(`Recarga por Telegram a #${targetId} procesada`);
                        }
                        else if(comando === "/ban" && targetId) {
                            if(targetId === "170125") {
                                sendTelegramNotification("⚠️ ERROR: No tienes permiso para banear al Súper Admin de URANIUM.");
                                continue; 
                            }
                            await db.collection("usuarios").doc(targetId).update({ banned: true });
                            sendTelegramNotification(`🚫 Usuario #${targetId} BANEADO de la página.`);
                        }
                        else if(comando === "/dban" && targetId) {
                            await db.collection("usuarios").doc(targetId).update({ banned: false });
                            sendTelegramNotification(`✅ Usuario #${targetId} DESBANEADO. Ya puede entrar.`);
                        }
                    }
                }
            }
        } catch(e) { }
    }, 10000); // <-- 10 segundos para no saturar el celular
}

// === FUNCIONES EXTRAS DEL ADMIN ===
async function addSubAdmin() {
    if(currentUser?.role !== "superadmin") return showToast("ACCESO DENEGADO");
    const id = document.getElementById('new-admin-id').value.trim();
    const email = document.getElementById('new-admin-email').value.trim().toLowerCase();
    const pass = document.getElementById('new-admin-pass').value.trim();
    if(!id || !email || !pass) return showToast("DATOS INCOMPLETOS");
    await db.collection("admins").doc(id).set({ id, email, pass });
    showToast("ADMIN AGREGADO CON ÉXITO"); closeModal('modal-manage-admins'); cargarAdminsEnDashboard();
}

async function cargarAdminsEnDashboard() {
    const area = document.getElementById('admins-render-area');
    if(!area) return;
    db.collection("admins").onSnapshot(snap => {
        area.innerHTML = '';
        if(snap.empty) { area.innerHTML = '<p>No hay sub-administradores activos.</p>'; return; }
        snap.forEach(doc => {
            const data = doc.data();
            area.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding: 5px 0;">
                <div><strong>ID:</strong> ${data.id} | <strong>Correo:</strong> ${data.email}</div>
                <button onclick="deleteAdmin('${doc.id}')" style="background:red; color:white; border:none; padding:5px; cursor:pointer; font-weight:bold;">X</button>
            </div>`;
        });
    });
}

async function deleteAdmin(docId) {
    if(confirm("¿Estás seguro de eliminar a este administrador?")) {
        await db.collection("admins").doc(docId).delete();
        await db.collection("usuarios").doc(docId).update({ role: 'user' });
        showToast("ADMIN ELIMINADO");
    }
}

async function updateSuperAdminCreds() {
    if(currentUser?.role !== "superadmin") return showToast("SOLO SÚPER ADMIN");
    const newEmail = document.getElementById('sec-new-email').value.trim().toLowerCase();
    const newPass = document.getElementById('sec-new-pass').value.trim();
    if(!newEmail || !newPass) return showToast("INGRESA AMBOS DATOS");
    await db.collection("usuarios").doc("170125").update({ adminEmail: newEmail, adminPass: newPass });
    closeModal('modal-security'); showToast("¡CREDENCIALES ACTUALIZADAS CON ÉXITO!");
    document.getElementById('sec-new-email').value = ''; document.getElementById('sec-new-pass').value = '';
}

async function inicializarSuperAdminSeguro() {
    const saDoc = await db.collection("usuarios").doc("170125").get();
    if (!saDoc.exists || !saDoc.data().adminEmail) {
        await db.collection("usuarios").doc("170125").set({
            role: 'superadmin', balance: 0, registered: true, username: 'admin', name: 'SÚPER ADMIN',
            id: "170125", adminEmail: 'admin@uranium.co', adminPass: '1234'               
        }, { merge: true });
    }
}
inicializarSuperAdminSeguro();

// ==========================================
// 7. PERFIL, RECARGA POR NEQUI Y COMPROBANTES
// ==========================================
function updateProfileUI() {
    const pId = document.getElementById('profile-id');
    const pName = document.getElementById('profile-name-display');
    const wBal = document.getElementById('wallet-balance');
    const rSec = document.getElementById('register-section');

    if(pId) pId.innerText = myUserId;
    if(pName) pName.innerText = currentUser?.registered ? currentUser.name : "INVITADO";
    if(wBal) wBal.innerText = `$${(currentUser?.balance || 0).toLocaleString()}`;
    if(currentUser?.registered && rSec) rSec.classList.add('hidden');
}

async function registerUser() {
    const user = document.getElementById('reg-username').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    if(!user || !name) return showToast("LLENA TODOS LOS DATOS");
    
    const snapshot = await db.collection("usuarios").where("username", "==", user).get();
    if (!snapshot.empty) return showToast("EL USUARIO YA EXISTE");

    await db.collection("usuarios").doc(myUserId).update({
        username: user, name: name, registered: true, balance: firebase.firestore.FieldValue.increment(5000)
    });
    showToast("¡REGISTRO EXITOSO! +$5000 AÑADIDOS A LA BILLETERA");
}

async function addBalanceToUser() {
    if(!isAdmin) return;
    const id = document.getElementById('bal-user-id').value.trim();
    const amt = parseInt(document.getElementById('bal-amount').value);
    if(!id || isNaN(amt)) return showToast("DATOS INVÁLIDOS");
    const doc = await db.collection("usuarios").doc(id).get();
    if(!doc.exists) return showToast("USUARIO NO ENCONTRADO EN LA BD");
    await db.collection("usuarios").doc(id).update({ balance: firebase.firestore.FieldValue.increment(amt) });
    showToast(`$${amt} RECARGADOS AL ID #${id}`); closeModal('modal-add-balance');
}

// NUEVA LÓGICA: Recarga de Saldo por Usuario
function openUserRecharge() {
    closeModal('modal-profile');
    document.getElementById('r-name').value = currentUser?.name || "";
    document.getElementById('r-amount').value = "";
    document.getElementById('recharge-form').classList.remove('hidden');
    document.getElementById('recharge-processing').classList.add('hidden');
    openModal('modal-user-recharge');
}

function processRecharge() {
    const name = document.getElementById('r-name').value.trim();
    const amount = document.getElementById('r-amount').value;
    if(!name || !amount) return showToast("LLENA TODOS LOS DATOS");

    document.getElementById('recharge-form').classList.add('hidden');
    document.getElementById('recharge-processing').classList.remove('hidden');

    currentReceiptContext = {
        type: 'recharge',
        name: name,
        amount: amount,
        token: "REC-" + Math.random().toString(36).substr(2,5).toUpperCase()
    };

    setTimeout(() => {
        closeModal('modal-user-recharge');
        showReceiptModal(`Envía $${parseInt(amount).toLocaleString()} al NEQUI 3137084357 para recargar tu saldo.`);
    }, 2000);
}

// NUEVA LÓGICA: Subir Comprobante (Universal)
function showReceiptModal(instructionText) {
    document.getElementById('receipt-instructions').innerText = instructionText + "\nAdjunta el comprobante aquí debajo.";
    document.getElementById('receipt-file-input').value = "";
    document.getElementById('receipt-preview').src = "";
    document.getElementById('receipt-preview').classList.add('hidden');
    document.getElementById('receipt-upload-label').classList.remove('hidden');
    currentReceiptFile = null;
    
    document.getElementById('receipt-form').classList.remove('hidden');
    document.getElementById('receipt-processing').classList.add('hidden');

    openModal('modal-receipt');
}

function previewReceipt() {
    const file = document.getElementById('receipt-file-input').files[0];
    if(file) {
        currentReceiptFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('receipt-preview').src = e.target.result;
            document.getElementById('receipt-preview').classList.remove('hidden');
            document.getElementById('receipt-upload-label').classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
}

async function submitReceipt() {
    if(!currentReceiptFile) return showToast("DEBES ADJUNTAR EL COMPROBANTE");

    document.getElementById('receipt-form').classList.add('hidden');
    document.getElementById('receipt-processing').classList.remove('hidden');

    let caption = "";
    if(currentReceiptContext.type === 'recharge') {
        caption = `💰 *SOLICITUD DE RECARGA*\n\n*Token:* ${currentReceiptContext.token}\n*Usuario:* ${currentReceiptContext.name}\n*ID:* #${myUserId}\n*Monto a recargar:* $${currentReceiptContext.amount}\n\n_Revisa el comprobante adjunto y recarga la billetera manualmente._`;
        addLog(`TOKEN: ${currentReceiptContext.token}`, `RECARGA PENDIENTE | $${currentReceiptContext.amount}`);
    } else {
        caption = `🛒 *NUEVA ORDEN (COMPROBANTE ADJUNTO)*\n\n*Token:* ${currentReceiptContext.token}\n*Cliente:* ${currentReceiptContext.name} (${currentReceiptContext.phone})\n*ID:* #${myUserId}\n*Servicios:* ${currentReceiptContext.details}\n*Total Pagado:* $${currentReceiptContext.amount}`;
        addLog(`TOKEN: ${currentReceiptContext.token}`, `NEQUI PENDIENTE | Total: $${currentReceiptContext.amount}`);
        cart = {}; updateCartUI(); // Vaciar carrito
    }

    await sendTelegramPhoto(currentReceiptFile, caption);

    closeModal('modal-receipt');
    showToast("¡COMPROBANTE ENVIADO CON ÉXITO! REVISAREMOS TU PAGO PRONTO.");
}

// ==========================================
// 8. PRODUCTOS, CATEGORÍAS Y ELIMINACIÓN
// ==========================================
async function saveNewCategory() {
    const name = document.getElementById('new-cat-name').value.trim();
    if(name) {
        await db.collection("categorias").add({ name: name.toUpperCase() });
        closeModal('modal-add-cat'); showToast("CATEGORÍA CREADA");
        document.getElementById('new-cat-name').value = "";
    }
}

function openDeleteCatModal() {
    const sel = document.getElementById('d-cat-select');
    sel.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    openModal('modal-delete-cat');
}

async function deleteCategory() {
    const id = document.getElementById('d-cat-select').value;
    if(!id) return showToast("SELECCIONA UNA CATEGORÍA");
    if(confirm("¿Seguro que quieres eliminar esta plataforma de raíz?")) {
        await db.collection("categorias").doc(id).delete();
        closeModal('modal-delete-cat');
        showToast("CATEGORÍA ELIMINADA");
    }
}

function openPublishModal(id = null) {
    editingId = id;
    if(id) {
        document.getElementById('pub-title').innerText = "EDITAR PRODUCTO";
        const p = products.find(prod => prod.id.toString() === id.toString());
        if(!p) return;
        
        document.getElementById('p-name').value = p.name || "";
        document.getElementById('p-short').value = p.short || "";
        document.getElementById('p-price').value = p.price || "";
        document.getElementById('p-cat-select').value = p.catId || "";
        document.getElementById('p-desc').value = p.desc || "";
        document.getElementById('p-contact').value = p.contact || "";
        document.getElementById('p-wa').value = p.wa || "";
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

async function deleteProduct(id) {
    if(confirm("¿Seguro que quieres eliminar este producto de la tienda para siempre?")) {
        await db.collection("productos").doc(id.toString()).delete();
        showToast("PRODUCTO ELIMINADO 🗑️");
    }
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
        }; reader.readAsDataURL(file);
    }
}

async function handleSaveProduct() {
    const name = document.getElementById('p-name').value.trim();
    const price = document.getElementById('p-price').value;
    
    if(!currentImg || !name || !price) return showToast("FOTO, NOMBRE Y PRECIO OBLIGATORIOS");

    const data = {
        name, 
        price: parseFloat(price),
        short: document.getElementById('p-short').value.trim(),
        desc: document.getElementById('p-desc').value.trim(),
        contact: document.getElementById('p-contact').value.trim() || "3128194596",
        wa: document.getElementById('p-wa').value.trim() || `Hola URANIUM, me interesa ${name}`,
        catId: document.getElementById('p-cat-select').value,
        pinned: document.getElementById('p-pinned').checked, 
        img: currentImg,
    };

    if(editingId) {
        await db.collection("productos").doc(editingId.toString()).update(data);
    } else {
        data.reactions = {};
        data.comments = [];
        await db.collection("productos").add(data);
    }

    closeModal('modal-publish'); showToast(editingId ? "PRODUCTO ACTUALIZADO" : "PRODUCTO PUBLICADO"); 
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
            ${isAdmin ? `
            <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; z-index: 10;">
                <button class="btn-edit-card" style="position: static;" onclick="event.stopPropagation(); openPublishModal('${p.id}')">✏️ EDITAR</button>
                <button class="btn-edit-card" style="position: static; background: red; padding: 5px 8px;" onclick="event.stopPropagation(); deleteProduct('${p.id}')">🗑️</button>
            </div>
            ` : ''}
            ${p.pinned ? `<div class="pin-badge">⭐ FIJADO</div>` : ''}
            <div class="card-img"><img src="${p.img}"></div>
            <div class="card-info">
                <h4>${p.name}</h4>
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
    const selDel = document.getElementById('d-cat-select');
    
    let htmlCats = categories.map(c => `<a href="#" onclick="renderGrid('${c.id}')">${c.name}</a>`).join('');
    let htmlMob = categories.map(c => `<button onclick="renderGrid('${c.id}')">${c.name}</button>`).join('');
    let htmlOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if(navPC) navPC.innerHTML = `<a href="#" onclick="renderGrid('all')">VER TODAS</a>` + htmlCats;
    if(navMob) navMob.innerHTML = `<button onclick="renderGrid('all')">TODAS</button>` + htmlMob;
    if(sel) sel.innerHTML = htmlOptions;
    if(selDel) selDel.innerHTML = htmlOptions;
    
    renderGrid();
}

// ==========================================
// 10. DETALLE DE PRODUCTO Y SISTEMA SOCIAL
// ==========================================
function openDetail(id) {
    const p = products.find(prod => prod.id.toString() === id.toString());
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
                    <button onclick="handleReaction('${p.id}', 'like')" style="color: ${myReaction==='like' ? 'var(--border-color)' : 'inherit'}">👍 <span>${likes}</span></button>
                    <button onclick="handleReaction('${p.id}', 'dislike')" style="color: ${myReaction==='dislike' ? 'var(--border-color)' : 'inherit'}">👎 <span>${dislikes}</span></button>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button class="btn-primary" onclick="addToCart('${p.id}'); closeModal('modal-detail')">AÑADIR AL CARRITO 🛒</button>
                    <button class="btn-wa" onclick="window.open('https://wa.me/57${p.contact || '3128194596'}?text=${encodeURIComponent(p.wa || 'Hola')}')">COMPRA YA EN WHATSAPP</button>
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
    if(reactions[myUserId] === type) delete reactions[myUserId]; else reactions[myUserId] = type;
    await ref.update({ reactions });
}

async function addComment(id) {
    const input = document.getElementById(`com-text-${id}`);
    if(!input.value) return showToast("ESCRIBE ALGO");
    await db.collection("productos").doc(id.toString()).update({
        comments: firebase.firestore.FieldValue.arrayUnion({ userId: myUserId, text: input.value, timestamp: new Date().toISOString() })
    });
    input.value = ""; showToast("COMENTARIO ENVIADO");
}

// ==========================================
// 11. GESTIÓN DEL CARRITO
// ==========================================
function addToCart(id) {
    if(cartCooldowns[id] && (Date.now() - cartCooldowns[id] < 1000)) return showToast("ESPERA 1 SEGUNDO...");
    cartCooldowns[id] = Date.now();
    
    const productData = products.find(p => p.id.toString() === id.toString());
    if(!productData) return showToast("ERROR: PRODUCTO NO ENCONTRADO");

    if(cart[id]) cart[id].qty++; else cart[id] = {...productData, qty: 1};
    updateCartUI(); showToast("AÑADIDO AL CARRITO 🛒");
}

function removeFromCart(id) { delete cart[id]; updateCartUI(); }

function updateCartUI() {
    const list = document.getElementById('cart-list'); let total = 0, count = 0;
    list.innerHTML = Object.values(cart).map(p => {
        total += (p.price * p.qty); count += p.qty;
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
// 12. PAGO CON NEQUI, BILLETERA Y COMPROBANTE AL CHECKOUT
// ==========================================

// --- NUEVO FLUJO DE BILLETERA CON WHATSAPP ---
function goToWalletPayment() {
    const total = Object.values(cart).reduce((sum, p) => sum + (p.price * p.qty), 0);
    if(total === 0) return showToast("CARRITO VACÍO");
    
    // Verifica si tiene saldo antes de pedir datos
    if(currentUser.balance < total) {
        return showToast("SALDO INSUFICIENTE. ¡RECARGA TU BILLETERA!");
    }

    // Llena el campo con el nombre de usuario si ya está registrado
    document.getElementById('w-pay-name').value = currentUser?.registered ? currentUser.name : "";
    document.getElementById('w-pay-phone').value = "";
    document.getElementById('w-pay-val').innerText = `$${total.toLocaleString()}`;
    
    closeModal('modal-cart');
    
    document.getElementById('wallet-form').classList.remove('hidden');
    document.getElementById('wallet-processing').classList.add('hidden');
    
    openModal('modal-wallet-confirm');
}

async function processWalletPayment() {
    const name = document.getElementById('w-pay-name').value.trim();
    const phone = document.getElementById('w-pay-phone').value.trim();
    const total = Object.values(cart).reduce((sum, p) => sum + (p.price * p.qty), 0);
    
    if(!name || phone.length < 10) return showToast("INGRESA TUS NOMBRES Y WHATSAPP VÁLIDO");
    if(currentUser.balance < total) return showToast("SALDO INSUFICIENTE");

    // Muestra animación de procesando
    document.getElementById('wallet-form').classList.add('hidden');
    document.getElementById('wallet-processing').classList.remove('hidden');

    // Descuenta el saldo en la base de datos
    await db.collection("usuarios").doc(myUserId).update({ 
        balance: firebase.firestore.FieldValue.increment(-total) 
    });
    
    const token = "WAL-" + Math.random().toString(36).substr(2,5).toUpperCase();
    let details = Object.values(cart).map(p => `${p.qty}x ${p.name}`).join(', ');
    addLog(`TOKEN: ${token}`, `WALLET: ${details} | Total: $${total}`);
    
    // Envia la info completa a Telegram (Incluyendo WhatsApp)
    let tgMsg = `🟢 *COMPRA FINALIZADA (BILLETERA)* 🟢\n\n*Token:* ${token}\n*Cliente:* ${name} (${phone})\n*ID Usuario:* #${myUserId}\n*Servicios:* ${details}\n*Total Descontado:* $${total}`;
    sendTelegramNotification(tgMsg);

    // Finaliza
    setTimeout(() => {
        cart = {}; 
        updateCartUI(); 
        closeModal('modal-wallet-confirm'); 
        showToast("¡COMPRA EXITOSA CON SALDO!");
    }, 1500);
}

// --- FLUJO DE NEQUI (Se mantiene igual) ---
function goToPayment() {
    if(Object.keys(cart).length === 0) return showToast("CARRITO VACÍO");
    closeModal('modal-cart'); openModal('modal-nequi');
}

function buyDirectNequi(id) {
    const p = products.find(prod => prod.id.toString() === id.toString()); 
    if(!p) return;
    cart = {}; addToCart(id); 
    closeModal('modal-detail'); openModal('modal-nequi');
}

function processPayment() {
    const name = document.getElementById('pay-name').value.trim();
    const phone = document.getElementById('pay-phone').value.trim();
    if(!name || phone.length < 10) return showToast("INGRESA UN NOMBRE Y NÚMERO VÁLIDOS");

    let total = Object.values(cart).reduce((sum, p) => sum + (p.price * p.qty), 0);

    document.getElementById('nequi-form').classList.add('hidden');
    document.getElementById('nequi-processing').classList.remove('hidden');

    currentReceiptContext = {
        type: 'checkout',
        name: name,
        phone: phone,
        amount: total,
        details: Object.values(cart).map(p => `${p.qty}x ${p.name}`).join(', '),
        token: "ORD-" + Math.random().toString(36).substr(2,5).toUpperCase()
    };

    setTimeout(() => {
        closeModal('modal-nequi');
        showReceiptModal(`Envía $${total.toLocaleString()} al NEQUI 3137084357 para completar tu orden.`);
        
        document.getElementById('nequi-form').classList.remove('hidden');
        document.getElementById('nequi-processing').classList.add('hidden');
    }, 2500); 
}

// LOGS
function addLog(action, item) {
    const log = document.getElementById('log-table');
    if(log) log.innerHTML = `<tr><td>${new Date().toLocaleTimeString()}</td><td>${action}</td><td>${item}</td></tr>` + log.innerHTML;
}
