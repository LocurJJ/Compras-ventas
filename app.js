const STORAGE_KEY = "compras-precios-v1";

const state = loadState();
let selectedImage = null;

const els = {
  today: document.querySelector("#today"),
  pendingForm: document.querySelector("#pendingForm"),
  pendingName: document.querySelector("#pendingName"),
  pendingQty: document.querySelector("#pendingQty"),
  pendingList: document.querySelector("#pendingList"),
  pendingCount: document.querySelector("#pendingCount"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  previewWrap: document.querySelector(".preview-wrap"),
  aiStatus: document.querySelector("#aiStatus"),
  aiHelp: document.querySelector("#aiHelp"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  addManualBtn: document.querySelector("#addManualBtn"),
  demoBtn: document.querySelector("#demoBtn"),
  purchaseRows: document.querySelector("#purchaseRows"),
  applyPurchaseBtn: document.querySelector("#applyPurchaseBtn"),
  stockList: document.querySelector("#stockList"),
  stockCount: document.querySelector("#stockCount"),
  whatsappText: document.querySelector("#whatsappText"),
  copyWhatsappBtn: document.querySelector("#copyWhatsappBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  toast: document.querySelector("#toast"),
};

els.today.textContent = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date());

els.pendingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = cleanName(els.pendingName.value);
  if (!name) return;
  state.pending.push({
    id: crypto.randomUUID(),
    name,
    qty: Number(els.pendingQty.value || 1),
    createdAt: new Date().toISOString(),
  });
  els.pendingForm.reset();
  saveAndRender("Producto agregado al pedido");
});

els.imageInput.addEventListener("change", () => {
  const file = els.imageInput.files[0];
  selectedImage = file || null;
  els.aiHelp.hidden = true;
  els.aiHelp.textContent = "";
  els.aiStatus.textContent = "Foto cargada";
  if (!file) return;
  els.imagePreview.src = URL.createObjectURL(file);
  els.previewWrap.classList.add("has-image");
});

els.analyzeBtn.addEventListener("click", analyzeImage);
els.addManualBtn.addEventListener("click", () => addPurchaseRow());
els.demoBtn.addEventListener("click", loadDemoInvoice);
els.applyPurchaseBtn.addEventListener("click", applyPurchase);
els.copyWhatsappBtn.addEventListener("click", copyWhatsapp);
els.exportBtn.addEventListener("click", exportData);
els.importInput.addEventListener("change", importData);

if (isStaticHost()) {
  els.aiStatus.textContent = "Modo GitHub: IA no disponible";
  els.aiHelp.hidden = false;
  els.aiHelp.textContent = "Esta pagina esta abierta desde GitHub Pages, que solo muestra la pantalla y guarda datos en este navegador. Para analizar fotos con IA hace falta ejecutar server.py en una computadora o desplegar un servidor.";
}

function loadState() {
  const fallback = {
    pending: [],
    stock: [],
    purchaseRows: [],
    lastWhatsapp: "",
    history: [],
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderPending();
  renderPurchaseRows();
  renderStock();
  els.whatsappText.value = state.lastWhatsapp || buildWhatsappMessage(state.stock);
}

function renderPending() {
  els.pendingCount.textContent = `${state.pending.length} pendiente${state.pending.length === 1 ? "" : "s"}`;
  els.pendingList.innerHTML = "";

  if (!state.pending.length) {
    els.pendingList.innerHTML = `<div class="item"><span class="meta">No hay productos pendientes.</span></div>`;
    return;
  }

  state.pending.forEach((item) => {
    const node = document.createElement("div");
    node.className = "item";
    node.innerHTML = `
      <div class="item-row">
        <strong>${escapeHtml(item.name)}</strong>
        <button class="danger mini" data-remove-pending="${item.id}">Quitar</button>
      </div>
      <div class="meta">Cantidad pedida: ${item.qty || 1}</div>
    `;
    els.pendingList.appendChild(node);
  });

  els.pendingList.querySelectorAll("[data-remove-pending]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pending = state.pending.filter((item) => item.id !== button.dataset.removePending);
      saveAndRender("Pendiente quitado");
    });
  });
}

function renderPurchaseRows() {
  els.purchaseRows.innerHTML = "";
  if (!state.purchaseRows.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" class="meta">Todavia no hay renglones cargados.</td>`;
    els.purchaseRows.appendChild(row);
    return;
  }

  state.purchaseRows.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input data-field="name" data-index="${index}" value="${escapeAttr(item.name)}" /></td>
      <td><input data-field="quantity" data-index="${index}" type="number" min="0" step="1" value="${Number(item.quantity || 1)}" /></td>
      <td><input data-field="unit_price" data-index="${index}" type="number" min="0" step="0.01" value="${Number(item.unit_price || 0)}" /></td>
      <td><button class="danger mini" data-remove-row="${index}">X</button></td>
    `;
    els.purchaseRows.appendChild(row);
  });

  els.purchaseRows.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      const item = state.purchaseRows[Number(input.dataset.index)];
      item[input.dataset.field] = input.dataset.field === "name" ? input.value : Number(input.value);
      saveState();
    });
  });

  els.purchaseRows.querySelectorAll("[data-remove-row]").forEach((button) => {
    button.addEventListener("click", () => {
      state.purchaseRows.splice(Number(button.dataset.removeRow), 1);
      saveAndRender("Renglon quitado");
    });
  });
}

function renderStock() {
  els.stockCount.textContent = `${state.stock.length} producto${state.stock.length === 1 ? "" : "s"}`;
  els.stockList.innerHTML = "";

  if (!state.stock.length) {
    els.stockList.innerHTML = `<div class="stock-item"><span class="meta">El stock se arma cuando aplicas compras.</span></div>`;
    return;
  }

  [...state.stock]
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .forEach((item) => {
      const node = document.createElement("div");
      node.className = "stock-item";
      const changed = item.previousPrice && item.price !== item.previousPrice;
      node.innerHTML = `
        <div class="stock-row">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="${changed ? "price-up" : ""}">$${money(item.price)}</span>
        </div>
        <div class="meta">Stock: ${item.stock} - Ultima compra: ${formatDate(item.updatedAt)}</div>
      `;
      els.stockList.appendChild(node);
    });
}

async function analyzeImage() {
  if (!selectedImage) {
    toast("Subi una foto primero");
    return;
  }

  if (isStaticHost()) {
    els.aiStatus.textContent = "IA no disponible en GitHub";
    els.aiHelp.hidden = false;
    els.aiHelp.textContent = "GitHub Pages no puede ejecutar el servidor de IA. Use Agregar renglon para cargar la compra manualmente, o ejecute el programa local con iniciar-compras-precios.bat.";
    toast("GitHub Pages no ejecuta IA");
    return;
  }

  els.aiStatus.textContent = "Analizando...";
  els.analyzeBtn.disabled = true;

  const knownItems = [
    ...state.pending.map((item) => item.name),
    ...state.stock.map((item) => item.name),
  ];
  const form = new FormData();
  form.append("image", selectedImage);
  form.append("known_items", JSON.stringify(knownItems));

  try {
    els.aiHelp.hidden = true;
    els.aiHelp.textContent = "";
    const response = await fetch("/api/analyze-image", {
      method: "POST",
      body: form,
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : { error: "La respuesta no vino del servidor de IA. Revise que server.py este corriendo." };
    if (!response.ok) throw new Error(readApiError(payload));
    const items = Array.isArray(payload.items) ? payload.items : [];
    state.purchaseRows = items.map(normalizePurchaseItem).filter((item) => item.name);
    saveAndRender(`${state.purchaseRows.length} renglon${state.purchaseRows.length === 1 ? "" : "es"} detectado${state.purchaseRows.length === 1 ? "" : "s"}`);
    els.aiStatus.textContent = payload.notes || "Analisis listo";
  } catch (error) {
    const missingKey = error.message.includes("OPENAI_API_KEY");
    const serverDown = error instanceof TypeError && error.message.includes("fetch");
    els.aiStatus.textContent = missingKey
      ? "Falta configurar IA"
      : serverDown
        ? "Servidor no conectado"
        : "No se pudo analizar";
    els.aiHelp.hidden = false;
    if (missingKey) {
      els.aiHelp.textContent = "La foto se subio bien, pero falta configurar OPENAI_API_KEY para que la IA pueda leer facturas. Mientras tanto, use Agregar renglon para cargar producto, cantidad y precio a mano.";
    } else if (serverDown) {
      els.aiHelp.textContent = "La pantalla esta abierta, pero el servidor de Python no esta conectado. Cierre esta pestana, abra iniciar-compras-precios.bat y entre por http://127.0.0.1:8765. Deje abierta la ventana negra mientras usa el programa.";
    } else if (error.message.toLowerCase().includes("quota")) {
      els.aiHelp.textContent = `${error.message}. Para probar sin pagar, toque Demo factura y cargamos renglones de ejemplo.`;
    } else {
      els.aiHelp.textContent = `${error.message}. Puede usar Agregar renglon para cargar la compra manualmente.`;
    }
    toast(error.message);
  } finally {
    els.analyzeBtn.disabled = false;
  }
}

function addPurchaseRow() {
  state.purchaseRows.push({
    name: "",
    quantity: 1,
    unit_price: 0,
  });
  saveAndRender("Renglon agregado");
}

function loadDemoInvoice() {
  state.purchaseRows = [
    { name: "Yogur cremigal frutilla", quantity: 20, unit_price: 800.54 },
    { name: "Yogur cremigal vainilla", quantity: 15, unit_price: 1161.33 },
    { name: "Yogur cremigal durazno", quantity: 15, unit_price: 1161.33 },
    { name: "Leche cremigal entera", quantity: 144, unit_price: 1224.98 },
    { name: "Manaos 2.25 cola", quantity: 24, unit_price: 292.91 },
    { name: "Manaos 2.25 pomelo blanco", quantity: 18, unit_price: 1229.91 },
    { name: "Manaos 1.5 naranja", quantity: 18, unit_price: 1229.91 },
  ];
  els.aiStatus.textContent = "Demo cargada";
  els.aiHelp.hidden = false;
  els.aiHelp.textContent = "Estos son renglones de ejemplo para probar el circuito completo sin gastar credito de OpenAI. Puede corregir nombres, cantidades y precios antes de aplicar la compra.";
  saveAndRender("Demo de factura cargada");
}

function applyPurchase() {
  const rows = state.purchaseRows.map(normalizePurchaseItem).filter((item) => item.name);
  if (!rows.length) {
    toast("No hay compra para aplicar");
    return;
  }

  rows.forEach((row) => {
    const existing = findByName(state.stock, row.name);
    if (existing) {
      existing.stock = Number(existing.stock || 0) + Number(row.quantity || 0);
      existing.previousPrice = Number(existing.price || 0);
      existing.price = Number(row.unit_price || existing.price || 0);
      existing.updatedAt = new Date().toISOString();
    } else {
      state.stock.push({
        id: crypto.randomUUID(),
        name: row.name,
        stock: Number(row.quantity || 0),
        price: Number(row.unit_price || 0),
        previousPrice: 0,
        updatedAt: new Date().toISOString(),
      });
    }

    const pendingMatch = findByName(state.pending, row.name);
    if (pendingMatch) {
      state.pending = state.pending.filter((item) => item.id !== pendingMatch.id);
    }
  });

  state.history.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    items: rows,
  });
  state.lastWhatsapp = buildWhatsappMessage(rows);
  state.purchaseRows = [];
  saveAndRender("Compra aplicada");
}

function buildWhatsappMessage(items) {
  const rows = items
    .filter((item) => Number(item.price ?? item.unit_price ?? 0) > 0)
    .map((item) => {
      const price = Number(item.price ?? item.unit_price ?? 0);
      return `- ${item.name}: $${money(price)}`;
    });

  if (!rows.length) {
    return "Actualizacion de precios\n\nSin precios cargados todavia.";
  }

  return `Actualizacion de precios\n\n${rows.join("\n")}`;
}

async function copyWhatsapp() {
  const text = els.whatsappText.value.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  toast("Mensaje copiado");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `compras-precios-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importData() {
  const file = els.importInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state.pending = Array.isArray(data.pending) ? data.pending : [];
      state.stock = Array.isArray(data.stock) ? data.stock : [];
      state.purchaseRows = Array.isArray(data.purchaseRows) ? data.purchaseRows : [];
      state.lastWhatsapp = data.lastWhatsapp || "";
      state.history = Array.isArray(data.history) ? data.history : [];
      saveAndRender("Datos importados");
    } catch {
      toast("El archivo no es valido");
    }
  };
  reader.readAsText(file);
}

function normalizePurchaseItem(item) {
  return {
    name: cleanName(item.name || item.product || ""),
    quantity: Number(item.quantity || item.qty || 1),
    unit_price: Number(item.unit_price || item.price || 0),
  };
}

function readApiError(payload) {
  if (!payload) return "No se pudo analizar";
  if (payload.details) {
    try {
      const details = JSON.parse(payload.details);
      const message = details.error?.message || details.message;
      if (message) return message;
    } catch {
      return payload.details;
    }
  }
  return payload.error || "No se pudo analizar";
}

function findByName(items, name) {
  const target = normalizeText(name);
  return items.find((item) => {
    const current = normalizeText(item.name);
    return current === target || current.includes(target) || target.includes(current);
  });
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeText(value) {
  return cleanName(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isStaticHost() {
  return location.hostname.endsWith("github.io") || location.protocol === "file:";
}

function money(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function saveAndRender(message) {
  saveState();
  render();
  if (message) toast(message);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

render();
