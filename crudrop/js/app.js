const CART_STORAGE_KEY = 'cruDropCart_v2';
const TOTALS_STORAGE_KEY = 'cruDropTotals_v2';
const DELIVERY_FEES = { SMALL: 200, BIG: 300, TRANSFER: 30 };
const BIG_PLATE_THRESHOLD = { PORTIONS: 4, SPAGHETTI_NAIRA: 1200 };

let appState = { cart: [] };

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if(sidebar) sidebar.classList.toggle('active');
  if(overlay) overlay.classList.toggle('active');
}

function toggleCart() {
  const cartDrawer = document.getElementById('cartDrawer');
  if(cartDrawer) cartDrawer.classList.toggle('active');
}

function addItem(itemName, itemPrice, quantity = 1) {
  const existingItem = appState.cart.find(item => item.name === itemName);
  if(existingItem) {
    existingItem.qty += quantity;
  } else {
    appState.cart.push({ name: itemName, price: itemPrice, qty: quantity });
  }
  saveAndRender();
}

function removeItem(itemName) {
  appState.cart = appState.cart.filter(item => item.name !== itemName);
  saveAndRender();
}

function updateQty(itemName, change) {
  const item = appState.cart.find(i => i.name === itemName);
  if(item) {
    item.qty += change;
    if(item.qty <= 0) removeItem(itemName);
    else saveAndRender();
  }
}

function clearCart() {
  if(confirm("Clear your entire cart?")) {
    appState.cart = [];
    saveAndRender();
  }
}

function calculateTotals() {
  let totals = { portions: 0, spaghettiTotal: 0, foodSubtotal: 0, waterBags: 0, deliveryFee: 0, grandTotal: 0, isBigPlate: false };
  
  for(const item of appState.cart) {
    totals.foodSubtotal += (item.price * item.qty);
    const lowerName = item.name.toLowerCase();
    
    if(lowerName.includes("spaghetti")) {
      totals.spaghettiTotal += (item.price * item.qty);
    } else if(lowerName.includes("bag of pure water")) {
      totals.waterBags += item.qty;
    } else if(!["pure water","bottled water","viju"].some(drink => lowerName.includes(drink))) {
      totals.portions += item.qty;
    }
  }
  
  const hasFood = totals.portions > 0 || totals.spaghettiTotal > 0;
  
  if(hasFood) {
    totals.isBigPlate = totals.portions >= BIG_PLATE_THRESHOLD.PORTIONS || totals.spaghettiTotal >= BIG_PLATE_THRESHOLD.SPAGHETTI_NAIRA;
    totals.deliveryFee = totals.isBigPlate ? DELIVERY_FEES.BIG : DELIVERY_FEES.SMALL;
  } else if(totals.waterBags > 0) {
    totals.deliveryFee = 200 * totals.waterBags;
  } else if(appState.cart.some(item => item.name.toLowerCase().includes("viju"))) {
    totals.deliveryFee = 200;
  }
  
  totals.grandTotal = totals.foodSubtotal + totals.deliveryFee + DELIVERY_FEES.TRANSFER;
  return totals;
}

function saveAndRender() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(appState.cart));
  renderUI();
}

function renderUI() {
  const cartItemsContainer = document.getElementById("cartItems");
  if(!cartItemsContainer) return;
  
  const currentTotals = calculateTotals();
  const totalItemCount = appState.cart.reduce((sum, item) => sum + item.qty, 0);
  
  const headerBadge = document.getElementById("cartCount");
  if(headerBadge) headerBadge.textContent = totalItemCount;
  
  const stickyCartWrapper = document.getElementById("stickyCart");
  if (totalItemCount > 0) {
    stickyCartWrapper.style.display = "block";
    document.getElementById("cartTotalText").textContent = "₦" + currentTotals.grandTotal;
  } else {
    stickyCartWrapper.style.display = "none";
    document.getElementById('cartDrawer').classList.remove('active');
  }
  
  cartItemsContainer.innerHTML = appState.cart.map(item => `
    <div class="row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border);">
      <div style="flex:1;">
        <h4 style="margin:0 0 4px; font-size:15px;">${item.name}</h4>
        <p style="margin:0; font-size:14px; color:var(--accent); font-weight:700;">₦${item.price * item.qty}</p>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px; background:var(--bg-main); padding:6px 10px; border-radius:20px; border:1px solid var(--border);">
          <button onclick="updateQty('${item.name}', -1)" style="background:none; border:none; color:var(--text-main); font-size:18px; cursor:pointer; display:flex; align-items:center;">−</button>
          <span style="font-weight:800; font-size:14px; min-width:16px; text-align:center;">${item.qty}</span>
          <button onclick="updateQty('${item.name}', 1)" style="background:none; border:none; color:var(--accent); font-size:18px; cursor:pointer; display:flex; align-items:center;">+</button>
        </div>
        <button onclick="removeItem('${item.name}')" style="background:rgba(239,68,68,0.1); border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--danger); transition:0.2s;">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    </div>
  `).join("") || "<p style='text-align:center;color:var(--text-muted);padding:20px 0;'>Your cart is empty</p>";
  
  localStorage.setItem(TOTALS_STORAGE_KEY, JSON.stringify(currentTotals));
  
  const plateBadge = document.getElementById('plateTypeBadge');
  if(plateBadge && totalItemCount > 0) {
    if(currentTotals.portions > 0 || currentTotals.spaghettiTotal > 0) {
      plateBadge.style.display = 'block';
      plateBadge.textContent = currentTotals.isBigPlate ? "Big Plate Delivery (₦300)" : `Small Plate Delivery (₦200) - Add ${4 - currentTotals.portions} more to upgrade`;
    } else {
      plateBadge.style.display = 'none'; 
    }
  }

  if(document.getElementById("subtotal")) document.getElementById("subtotal").textContent = "₦" + currentTotals.foodSubtotal;
  if(document.getElementById("delivery")) document.getElementById("delivery").textContent = "₦" + currentTotals.deliveryFee;
  if(document.getElementById("transfer")) document.getElementById("transfer").textContent = "₦" + DELIVERY_FEES.TRANSFER;
  if(document.getElementById("total")) document.getElementById("total").textContent = "₦" + currentTotals.grandTotal;
}

window.addEventListener("DOMContentLoaded", () => {
  const savedCartData = localStorage.getItem(CART_STORAGE_KEY);
  if(savedCartData) appState.cart = JSON.parse(savedCartData);
  renderUI();
});

// THE FIX: Ensure the button is clickable and redirects
document.body.addEventListener("click", function(event) {
  if(event.target.classList.contains("checkout-btn") || event.target.id === "checkoutBtn") {
    if(appState.cart.length > 0) {
      window.location.href = "/checkout.html";
    }
  }
});