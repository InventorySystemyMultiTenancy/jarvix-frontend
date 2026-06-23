const $ = (selector) => document.querySelector(selector);
const state = { dashboard: null, modal: null };
const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const DOWNLOAD_URL = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL
  || "https://github.com/InventorySystemyMultiTenancy/jarvix-backend/releases/latest/download/Jarvix-Windows-x64.zip";
const viewTitles = {
  home: ["CENTRAL PESSOAL", "Bom dia, senhor."],
  devices: ["CASA CONECTADA", "Seus dispositivos"],
  reminders: ["ORGANIZAÇÃO", "Alertas e atividades"],
  routines: ["AUTOMAÇÃO", "Suas rotinas"],
  integrations: ["SERVIÇOS", "Integrações do Jarvix"],
};

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.status === 204 ? null : response.json();
}

function escapeHtml(value = "") {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

async function loadDashboard() {
  state.dashboard = await api("/api/dashboard");
  const { summary, reminders, routines, devices, integrations } = state.dashboard;
  $("#devicesOnline").textContent = summary.devices_online;
  $("#pendingReminders").textContent = summary.pending_reminders;
  $("#activeRoutines").textContent = summary.active_routines;
  $("#reminderList").innerHTML = reminders.length ? reminders.slice(0, 5).map(item => `
    <div class="item"><div><strong>${escapeHtml(item.title)}</strong><span>${formatDate(item.scheduled_at)}</span></div>
    <button onclick="removeItem('reminders',${item.id})">×</button></div>`).join("") : `<p class="empty">Nenhum alerta cadastrado.</p>`;
  $("#routineList").innerHTML = routines.length ? routines.slice(0, 5).map(item => `
    <div class="item"><div><strong>${escapeHtml(item.name)}</strong><span>“${escapeHtml(item.trigger_text)}”</span></div>
    <button onclick="removeItem('routines',${item.id})">×</button></div>`).join("") : `<p class="empty">Nenhuma rotina criada.</p>`;
  $("#deviceList").innerHTML = devices.length ? devices.map(item => `
    <div class="device"><i class="dot ${item.status === "online" ? "online" : ""}"></i><strong>${escapeHtml(item.name)}</strong>
    <span>${escapeHtml(item.kind)} · ${escapeHtml(item.room || "Sem cômodo")}</span></div>`).join("") : `<p class="empty">Cadastre lâmpadas, computadores, hubs e outros dispositivos.</p>`;
  $("#integrationList").innerHTML = integrations.map(item => `
    <div class="integration"><strong>${escapeHtml(item.display_name)}</strong>
    <span>${item.status === "connected" ? "Conectado" : "Aguardando configuração oficial"}</span>
    <button class="integration-action" data-provider="${escapeHtml(item.display_name)}">${item.status === "connected" ? "Gerenciar" : "Configurar"}</button></div>`).join("");

  document.querySelectorAll(".integration-action").forEach(button => {
    button.addEventListener("click", () => {
      window.alert(`A conexão com ${button.dataset.provider} será liberada quando o conector oficial for configurado.`);
    });
  });
}

function selectView(view) {
  const selectedView = viewTitles[view] ? view : "home";
  document.querySelectorAll(".nav").forEach(button => {
    button.classList.toggle("active", button.dataset.view === selectedView);
  });
  document.querySelectorAll("[data-view-section]").forEach(section => {
    const isHome = selectedView === "home";
    section.hidden = !isHome && section.dataset.viewSection !== selectedView;
  });
  $(".grid").classList.toggle("focused", selectedView !== "home");
  const [eyebrow, title] = viewTitles[selectedView];
  $("header .eyebrow").textContent = eyebrow;
  $("header h1").textContent = title;
  history.replaceState(null, "", selectedView === "home" ? location.pathname : `#${selectedView}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", () => selectView(button.dataset.view));
});

$(".brand").addEventListener("click", event => {
  event.preventDefault();
  selectView("home");
});

$("#desktopDownload").href = DOWNLOAD_URL;

window.removeItem = async (resource, id) => {
  await api(`/api/${resource}/${id}`, { method: "DELETE" });
  await loadDashboard();
};

const fieldSets = {
  reminder: {
    title: "Novo alerta", endpoint: "/api/reminders",
    fields: [
      ["title", "Título", "text", "Tomar medicamento"],
      ["scheduled_at", "Data e hora", "datetime-local", ""],
      ["notes", "Observação", "text", "Opcional"],
    ],
  },
  routine: {
    title: "Nova rotina", endpoint: "/api/routines",
    fields: [
      ["name", "Nome", "text", "Bom dia"],
      ["trigger_text", "Frase de ativação", "text", "Jarvix, iniciar meu dia"],
    ],
  },
  device: {
    title: "Cadastrar dispositivo", endpoint: "/api/devices",
    fields: [
      ["name", "Nome", "text", "Luz do escritório"],
      ["kind", "Tipo", "text", "Lâmpada"],
      ["room", "Cômodo", "text", "Escritório"],
    ],
  },
};

document.querySelectorAll("[data-modal]").forEach(button => button.addEventListener("click", () => {
  state.modal = fieldSets[button.dataset.modal];
  $("#modalTitle").textContent = state.modal.title;
  $("#modalFields").innerHTML = state.modal.fields.map(([name, label, type, placeholder]) => `
    <div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" placeholder="${placeholder}" ${name !== "notes" ? "required" : ""}></div>`).join("");
  $("#editor").showModal();
}));

$("#editorForm").addEventListener("submit", async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  if (state.modal.endpoint.endsWith("routines")) payload.actions = [];
  await api(state.modal.endpoint, { method: "POST", body: JSON.stringify(payload) });
  $("#editor").close();
  event.currentTarget.reset();
  await loadDashboard();
});

async function askJarvix(message) {
  $("#assistantText").textContent = "Pensando...";
  try {
    const result = await api("/api/assistant/chat", { method: "POST", body: JSON.stringify({ message }) });
    $("#assistantText").textContent = result.text;
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(result.text));
    }
  } catch {
    $("#assistantText").textContent = "Não consegui responder agora. Verifique a configuração do servidor.";
  }
}

$("#chatForm").addEventListener("submit", event => {
  event.preventDefault();
  const input = $("#chatInput");
  if (input.value.trim()) askJarvix(input.value.trim());
  input.value = "";
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.onstart = () => { $("#voiceButton").classList.add("listening"); $("#voiceState").textContent = "Ouvindo..."; };
  recognition.onend = () => { $("#voiceButton").classList.remove("listening"); $("#voiceState").textContent = "Toque para falar"; };
  recognition.onresult = event => askJarvix(event.results[0][0].transcript);
  $("#voiceButton").addEventListener("click", () => recognition.start());
} else {
  $("#voiceButton").addEventListener("click", () => $("#voiceState").textContent = "Reconhecimento de voz indisponível neste navegador");
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
selectView(location.hash.replace("#", "") || "home");
loadDashboard().catch(() => $("#assistantText").textContent = "Não foi possível carregar o painel.");
