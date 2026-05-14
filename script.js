// CONFIG
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

const BOT_TOKEN = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ";
const CHAT_ID = "7056557759";
const WHATSAPP = "573043344577";

let cart = [];

// RENDER PÚBLICO
function render(cat = 'all') {
    const grid = document.getElementById('grid');
    db.collection("productos").onSnapshot(snap => {
        grid.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            if(cat === 'all' || p.category === cat) {
                grid.innerHTML += `
                <div class="card">
                    <img src="${p.img || 'https://via.placeholder.com/400x600'}">
                    <h4>${p.name}</h4>
                    <p class="price">$${Number(p.price).toLocaleString()}</p>
                    <button class="btn-black" onclick="addToCart('${p.name}', ${p.price})">AÑADIR AL CARRITO</button>
                </div>`;
            }
        });
    });
}

// SISTEMA CARRITO
window.addToCart = (name, price) => {
    cart.push({name, price});
    document.getElementById('cart-count').innerText = cart.length;
    alert(`${name} añadido.`);
};

document.getElementById('cart-open').onclick = () => {
    const list = document.getElementById('cart-list');
    let total = 0;
    list.innerHTML = "";
    cart.forEach(item => {
        list.innerHTML += `<div class="cart-item"><span>${item.name}</span><span>$${item.price.toLocaleString()}</span></div>`;
        total += item.price;
    });
    document.getElementById('total-val').innerText = total.toLocaleString();
    document.getElementById('modal-cart').style.display = 'flex';
};

// PAGOS
document.getElementById('pay-nequi').onclick = () => {
    if(cart.length === 0) return alert("Carrito vacío");
    document.getElementById('modal-cart').style.display = 'none';
    document.getElementById('modal-nequi').style.display = 'flex';
};

document.getElementById('confirm-telegram').onclick = () => {
    let msg = "💰 NUEVO PAGO NEQUI\n\n";
    let total = 0;
    cart.forEach(i => { msg += `- ${i.name}\n`; total += i.price; });
    msg += `\nTOTAL: $${total.toLocaleString()}`;

    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`)
    .then(() => {
        alert("Reporte enviado. Entrega por WhatsApp.");
        window.open(`https://wa.me/${WHATSAPP}?text=Hola, acabo de pagar por Nequi mi pedido.`);
        cart = [];
        document.getElementById('cart-count').innerText = 0;
        closeModal('modal-nequi');
    });
};

// ADMIN
document.getElementById('admin-login-btn').onclick = () => document.getElementById('modal-login').style.display = 'flex';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

document.getElementById('btn-do-login').onclick = () => {
    const e = document.getElementById('log-email').value;
    const p = document.getElementById('log-pass').value;
    auth.signInWithEmailAndPassword(e, p).then(() => closeModal('modal-login')).catch(() => alert("Error"));
};

auth.onAuthStateChanged(user => {
    const dash = document.getElementById('admin-dash');
    dash.style.display = (user && user.email === "Juanrivera@urm.co") ? "block" : "none";
});

document.getElementById('btn-logout').onclick = () => auth.signOut();

document.getElementById('btn-publish').onclick = () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const img = document.getElementById('p-img').value;
    const category = document.getElementById('p-cat').value;
    if(name && price) {
        db.collection("productos").add({ name, price, img, category })
        .then(() => alert("Publicado"));
    }
};

window.onload = () => render();
    
