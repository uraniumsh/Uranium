// CONFIG FIREBASE
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

const NEQUI_NUM = "3137074357";
const WA_NUM = "573043344577";
const TG_BOT = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ";
const TG_CHAT = "7056557759";

let cart = [];
let myID = localStorage.getItem('uranium_uid') || 'ID-' + Math.random().toString(36).substr(2, 6).toUpperCase();
localStorage.setItem('uranium_uid', myID);
document.getElementById('device-tag').innerText = `ID: ${myID}`;

// SISTEMA DE ADMIN POR DISPOSITIVO (Los 2 primeros)
function checkAdmin() {
    const adminRef = db.collection("config").doc("admins");
    adminRef.get().then(doc => {
        let admins = doc.exists ? doc.data().list : [];
        if (admins.length < 2 && !admins.includes(myID)) {
            admins.push(myID);
            adminRef.set({ list: admins });
        }
        if (admins.includes(myID)) {
            document.getElementById('admin-sidebar').style.display = 'block';
        }
    });
}
checkAdmin();

// CARGA PÚBLICA DE PRODUCTOS
function render(cat = 'all') {
    db.collection("productos").onSnapshot(snap => {
        const grid = document.getElementById('products-grid');
        grid.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            if (cat === 'all' || p.categoria === cat) {
                grid.innerHTML += `
                <div class="card" onclick="showDetail('${doc.id}')">
                    <div class="card-img-box"><img src="${p.img}"></div>
                    <h4>${p.nombre}</h4>
                    <p>$${Number(p.precio).toLocaleString()}</p>
                </div>`;
            }
        });
    });
}

// MOSTRAR DETALLE
window.showDetail = (id) => {
    db.collection("productos").doc(id).get().then(doc => {
        const p = doc.data();
        document.getElementById('detail-content').innerHTML = `
            <img src="${p.img}">
            <h2>${p.nombre}</h2>
            <p style="margin: 15px 0; color: #666;">${p.desc || 'Sin descripción'}</p>
            <h3 style="color: #000;">$${Number(p.precio).toLocaleString()}</h3>
        `;
        document.getElementById('add-to-cart-btn').onclick = () => addToCart(p.nombre, p.precio);
        document.getElementById('modal-detail').style.display = 'flex';
    });
};

// CARRITO
function addToCart(name, price) {
    cart.push({ name, price });
    document.getElementById('cart-qty').innerText = cart.length;
    closeModals();
}

window.openCart = () => {
    const list = document.getElementById('cart-items-list');
    let total = 0; list.innerHTML = "";
    cart.forEach(i => {
        list.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:0.8rem;">
            <span>${i.name}</span><span>$${i.price.toLocaleString()}</span>
        </div>`;
        total += i.price;
    });
    document.getElementById('total-val').innerText = total.toLocaleString();
    document.getElementById('modal-cart').style.display = 'flex';
};

// PAGOS Y NOTIFICACIONES
window.payNequi = () => {
    const name = document.getElementById('client-name').value;
    if (!name) return alert("Ingresa tu nombre para el reporte.");

    let items = cart.map(i => i.name).join(", ");
    let total = document.getElementById('total-val').innerText;

    const msg = `💰 PAGO NEQUI\n👤 Cliente: ${name}\n🆔 ID: ${myID}\n🛒 Pedido: ${items}\n💵 Total: $${total}`;

    // Notificar Telegram
    fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage?chat_id=${TG_CHAT}&text=${encodeURIComponent(msg)}`)
    .then(() => {
        alert(`Transfiere $${total} a Nequi: ${NEQUI_NUM}. Se abrirá WhatsApp para entrega.`);
        window.open(`https://wa.me/${WA_NUM}?text=Hola Uranium, soy ${name} (ID: ${myID}). Acabo de pagar Nequi por: ${items}`);
        cart = []; document.getElementById('cart-qty').innerText = 0;
        closeModals();
    });
};

// SUBIR PRODUCTO (ADMIN)
window.uploadProduct = () => {
    const nombre = document.getElementById('p-name').value;
    const precio = document.getElementById('p-price').value;
    const img = document.getElementById('p-img').value;
    const desc = document.getElementById('p-desc').value;
    const categoria = document.getElementById('p-cat').value;

    if (nombre && precio) {
        db.collection("productos").add({ nombre, precio, img, desc, categoria })
        .then(() => {
            alert("Subido!");
            document.querySelectorAll('.admin-form input').forEach(i => i.value = "");
        });
    }
};

window.closeModals = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
window.onload = () => render();
            
