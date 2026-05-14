// CONFIGURACIÓN FIREBASE
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

// CONFIGURACIÓN DE CONTACTO
const numeroWhatsApp = "573043344577"; 
const telegramBotToken = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ"; 
const telegramChatId = "7056557759";

let carrito = [];
let userUID = null;

// ID de Dispositivo
if (!localStorage.getItem('uranium_device')) {
    localStorage.setItem('uranium_device', 'DEV-' + Math.random().toString(36).substr(2, 5).toUpperCase());
}

// GESTIÓN DE USUARIOS
auth.onAuthStateChanged((user) => {
    const loginBtn = document.getElementById('btn-show-login');
    const regBtn = document.getElementById('btn-show-register');
    const logoutBtn = document.getElementById('logout-btn');
    const greeting = document.getElementById('user-greeting');
    const adminPanel = document.getElementById('admin-panel');

    if (user) {
        userUID = user.uid;
        loginBtn.style.display = 'none';
        regBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        greeting.style.display = 'block';

        if (user.email === "Juanrivera@urm.co") {
            adminPanel.style.display = 'block';
            greeting.innerText = "Panel Admin Uranium";
        } else {
            db.collection("usuarios").doc(user.uid).get().then(doc => {
                if(doc.exists) greeting.innerText = "Hola, " + doc.data().nombre;
            });
        }
    } else {
        userUID = null;
        loginBtn.style.display = 'block';
        regBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        greeting.style.display = 'none';
        adminPanel.style.display = 'none';
    }
});

// MODALES
document.getElementById('btn-show-register').onclick = () => document.getElementById('register-modal').style.display='flex';
document.getElementById('btn-show-login').onclick = () => document.getElementById('login-modal').style.display='flex';
document.querySelectorAll('.close-modals').forEach(b => b.onclick = () => document.querySelectorAll('.modal').forEach(m=>m.style.display='none'));

// REGISTRO
document.getElementById('confirm-register').onclick = () => {
    const n = document.getElementById('reg-nombre').value;
    const a = document.getElementById('reg-apellido').value;
    const e = document.getElementById('reg-email').value;
    const p = document.getElementById('reg-pass').value;
    auth.createUserWithEmailAndPassword(e, p).then(cred => {
        db.collection("usuarios").doc(cred.user.uid).set({nombre:n, apellido:a, device: localStorage.getItem('uranium_device')});
        document.querySelectorAll('.modal').forEach(m=>m.style.display='none');
    }).catch(err => alert(err.message));
};

// LOGIN
document.getElementById('confirm-login').onclick = () => {
    const e = document.getElementById('log-email').value;
    const p = document.getElementById('log-pass').value;
    auth.signInWithEmailAndPassword(e, p).then(() => {
        document.querySelectorAll('.modal').forEach(m=>m.style.display='none');
    }).catch(() => alert("Error al ingresar"));
};

document.getElementById('logout-btn').onclick = () => auth.signOut();

// ADMIN: SUBIR PRODUCTOS
document.getElementById('btn-guardar-prod').onclick = () => {
    const n = document.getElementById('prod-nombre').value;
    const c = document.getElementById('prod-categoria').value;
    const p = Number(document.getElementById('prod-precio').value);
    const i = document.getElementById('prod-img').value;
    if(n && p) {
        db.collection("productos").add({
            nombre: n, categoria: c, precio: p, 
            img: i || "https://via.placeholder.com/200x130?text="+encodeURIComponent(n) 
        }).then(() => {
            alert("Producto Publicado");
            document.getElementById('prod-nombre').value = "";
            document.getElementById('prod-precio').value = "";
            document.getElementById('prod-img').value = "";
        });
    }
};

// RENDERIZAR PRODUCTOS
const grid = document.getElementById('products-grid');
function render(f = "all") {
    db.collection("productos").onSnapshot(snap => {
        grid.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            if(f === "all" || p.categoria === f) {
                grid.innerHTML += `
                <div class="product-card">
                    <img src="${p.img}" class="product-img">
                    <div class="product-title">${p.nombre}</div>
                    <div class="product-price">$${p.precio.toLocaleString()}</div>
                    <button class="btn-secondary btn-add-cart" onclick="add('${p.nombre}', ${p.precio})">🛒 Carrito</button>
                    <button class="btn-primary btn-buy-now" onclick="buy('${p.nombre}', ${p.precio})">⚡ Comprar Ya</button>
                </div>`;
            }
        });
    });
}
render();

// FILTROS
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = (e) => {
        e.preventDefault();
        render(btn.dataset.filter);
        document.getElementById('sidebar').classList.remove('active');
    };
});

// CARRITO
window.add = (n, p) => {
    carrito.push({n, p});
    document.getElementById('cart-count').innerText = carrito.length;
};

window.buy = (n, p) => {
    const dev = localStorage.getItem('uranium_device');
    window.open(`https://wa.me/${numeroWhatsApp}?text=Hola Uranium, quiero comprar ${n} ($${p.toLocaleString()}). ID: ${dev}`);
};

document.getElementById('cart-icon').onclick = () => {
    const items = document.getElementById('cart-items');
    let t = 0; items.innerHTML = "";
    carrito.forEach(i => { items.innerHTML += `<div class="cart-item"><span>${i.n}</span><span>$${i.p.toLocaleString()}</span></div>`; t+=i.p; });
    document.getElementById('cart-total').innerText = "Total: $" + t.toLocaleString();
    document.getElementById('cart-modal').style.display='flex';
};

// COMPRA WHATSAPP
document.getElementById('checkout-wa').onclick = () => {
    if(carrito.length === 0) return;
    let m = "Pedido Uranium:\n";
    let total = 0;
    carrito.forEach(i => { m += "- " + i.n + "\n"; total += i.p; });
    m += "\nTotal: $" + total.toLocaleString();
    window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(m)}`);
};

// COMPRA NEQUI (Telegram)
document.getElementById('checkout-nequi').onclick = () => {
    if(!userUID) return alert("Inicia sesión para pagar con Nequi.");
    document.getElementById('cart-modal').style.display='none';
    document.getElementById('nequi-modal').style.display='flex';
};

document.getElementById('confirm-nequi-telegram').onclick = () => {
    let t = 0; 
    let m = `💰 PAGO NEQUI\nCliente UID: ${userUID}\nDispositivo: ${localStorage.getItem('uranium_device')}\n\n🛒 Pedido:\n`;
    carrito.forEach(i => { m += "- " + i.n + "\n"; t+=i.p; });
    m += `\nTotal: $${t.toLocaleString()}`;

    fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage?chat_id=${telegramChatId}&text=${encodeURIComponent(m)}`)
    .then(() => {
        alert("¡Reporte enviado! Validaremos el pago y te contactaremos.");
        carrito = []; 
        document.getElementById('cart-count').innerText = 0;
        document.getElementById('nequi-modal').style.display='none';
    }).catch(() => alert("Error al notificar pago."));
};

document.getElementById('menu-toggle').onclick = () => document.getElementById('sidebar').classList.toggle('active');
