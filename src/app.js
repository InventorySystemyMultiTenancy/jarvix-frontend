const $ = (selector) => document.querySelector(selector);
const state = { dashboard: null, modal: null, user: null };
const API_BASE = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const DOWNLOAD_URL = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL
  || "/JarvisBuilder.zip";
const TOKEN_KEY = "jarvix_access_token";
const WAKE_WORDS = ["jarvis", "jarvix", "jatrvis", "javis", "jarves", "jarvez", "jarvi"];
const SCHEDULED_ACTIONS_KEY = "jarvix_scheduled_actions";

const viewTitles = {
  home: ["CENTRAL PESSOAL", "Bom dia, senhor."],
  devices: ["CASA CONECTADA", "Seus dispositivos"],
  reminders: ["ORGANIZAÇÃO", "Alertas e atividades"],
  routines: ["AUTOMAÇÃO", "Suas rotinas"],
  media: ["BIBLIOTECA", "Músicas e álbuns"],
  integrations: ["SERVIÇOS", "Integrações do Jarvix"],
};

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(value) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    logout("Sessão expirada. Entre novamente.");
    throw new Error("Não autorizado");
  }
  if (!response.ok) {
    let message = await response.text();
    try {
      message = JSON.parse(message).detail || message;
    } catch {}
    throw new Error(message);
  }
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

function homeAssistantControls(item) {
  const metadata = item.metadata || {};
  if (metadata.integration !== "home_assistant") return "";
  const commands = metadata.commands?.length ? metadata.commands : fallbackHomeAssistantCommands(metadata);
  if (!commands.length) return `<small>Entidade Home Assistant: ${escapeHtml(metadata.entity_id || "")}</small>`;
  return `<div class="device-actions">${commands.map(command =>
    Array.isArray(command)
      ? `<button onclick="commandDevice(${item.id},'${command[0]}')">${escapeHtml(command[1])}</button>`
      : `<button onclick="commandDevice(${item.id},'${command.command}')">${escapeHtml(command.label || command.command)}</button>`
  ).join("")}</div>`;
}

function fallbackHomeAssistantCommands(metadata) {
  const domain = metadata.domain || (metadata.entity_id || "").split(".")[0];
  return ["light", "switch", "fan", "media_player", "climate"].includes(domain)
    ? [["turn_on", "Ligar"], ["turn_off", "Desligar"], ["toggle", "Alternar"]]
    : domain === "cover"
      ? [["open", "Abrir"], ["close", "Fechar"]]
      : domain === "lock"
        ? [["open", "Destravar"], ["close", "Travar"]]
        : domain === "vacuum"
          ? [["turn_on", "Iniciar"], ["turn_off", "Base"]]
          : ["button", "input_button"].includes(domain)
            ? [["press", "Pressionar"]]
            : domain === "automation"
              ? [["trigger", "Disparar"], ["turn_on", "Ativar"], ["turn_off", "Desativar"]]
              : ["scene", "script"].includes(domain)
                ? [["turn_on", "Executar"]]
                : [];
}

function showAuth(message = "") {
  $("#authScreen").hidden = false;
  $("#appShell").hidden = true;
  $("#authMessage").textContent = message;
}

function showApp() {
  $("#authScreen").hidden = true;
  $("#appShell").hidden = false;
}

function setAuthMode(mode) {
  const isRegister = mode === "register";
  $("#loginTab").classList.toggle("active", !isRegister);
  $("#registerTab").classList.toggle("active", isRegister);
  $("#loginForm").hidden = isRegister;
  $("#registerForm").hidden = !isRegister;
  $("#authMessage").textContent = "";
}

async function submitAuth(path, form) {
  $("#authMessage").textContent = "Conectando...";
  try {
    const payload = Object.fromEntries(new FormData(form));
    const result = await api(path, { method: "POST", body: JSON.stringify(payload) });
    setToken(result.access_token);
    state.user = result.user;
    form.reset();
    await startApp();
  } catch (error) {
    $("#authMessage").textContent = error.message || "Não foi possível entrar agora.";
  }
}

function logout(message = "") {
  setToken("");
  state.user = null;
  showAuth(message);
}

async function startApp() {
  if (!token()) {
    showAuth();
    return;
  }
  try {
    const result = await api("/api/auth/me");
    state.user = result.user;
    $("#currentUserName").textContent = state.user.name;
    $("#currentUserEmail").textContent = state.user.email;
    showApp();
    selectView(location.hash.replace("#", "") || "home");
    await loadDashboard();
  } catch {
    showAuth("Entre para acessar sua memória Jarvix.");
  }
}

async function loadDashboard() {
  state.dashboard = await api("/api/dashboard");
  const { summary, reminders, routines, devices, integrations, media = [] } = state.dashboard;
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
    <span>${escapeHtml(item.kind)} · ${escapeHtml(item.room || "Sem cômodo")}</span>
    ${homeAssistantControls(item)}
    <button onclick="removeItem('devices',${item.id})">Remover</button></div>`).join("") : `<p class="empty">Cadastre lâmpadas, computadores, hubs e outros dispositivos.</p>`;
  $("#integrationList").innerHTML = integrations.map(item => `
    <div class="integration"><strong>${escapeHtml(item.display_name)}</strong>
    <span>${item.status === "connected" ? `Conectado${item.config?.base_url ? ` em ${escapeHtml(item.config.base_url)}` : ""}` : "Aguardando configuração"}</span>
    <button class="integration-action" data-provider="${escapeHtml(item.provider)}">${item.status === "connected" ? "Gerenciar" : "Configurar"}</button></div>`).join("");
  $("#mediaList").innerHTML = media.length ? media.map(item => `
    <div class="device"><strong>${escapeHtml(item.title)}</strong>
    <span>${escapeHtml(item.artist || "Artista não informado")} · ${escapeHtml(item.album || item.media_type)}</span>
    <button onclick="removeItem('media',${item.id})">Remover</button></div>`).join("")
    : `<p class="empty">Adicione músicas, álbuns ou playlists para o Jarvix lembrar.</p>`;

  document.querySelectorAll(".integration-action").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.provider === "home_assistant") configureHomeAssistant();
      else window.alert(`A conexão com ${button.dataset.provider} será liberada quando o conector oficial for configurado.`);
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

$("#loginTab").addEventListener("click", () => setAuthMode("login"));
$("#registerTab").addEventListener("click", () => setAuthMode("register"));
$("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  submitAuth("/api/auth/login", event.currentTarget);
});
$("#registerForm").addEventListener("submit", event => {
  event.preventDefault();
  submitAuth("/api/auth/register", event.currentTarget);
});
$("#logoutButton").addEventListener("click", () => logout("Você saiu da sua conta Jarvix."));

$("#desktopDownload").href = DOWNLOAD_URL;

window.removeItem = async (resource, id) => {
  await api(`/api/${resource}/${id}`, { method: "DELETE" });
  await loadDashboard();
};

window.commandDevice = async (id, command) => {
  try {
    await api(`/api/devices/${id}/command`, { method: "POST", body: JSON.stringify({ command }) });
    appendChatMessage("bot", "Comando enviado ao Home Assistant.");
    await loadDashboard();
  } catch (error) {
    window.alert(error.message || "Não foi possível controlar o dispositivo.");
  }
};

async function configureHomeAssistant() {
  const baseUrl = window.prompt("URL externa do Home Assistant. Use Nabu Casa, Cloudflare Tunnel ou outra URL pública HTTPS.", "https://sua-casa.ui.nabu.casa");
  if (!baseUrl) return;
  const tokenValue = window.prompt("Cole o Long-Lived Access Token do Home Assistant");
  if (!tokenValue) return;
  try {
    appendChatMessage("bot", "Conectando ao Home Assistant...");
    await api("/api/integrations/home-assistant", {
      method: "POST",
      body: JSON.stringify({ base_url: baseUrl, token: tokenValue }),
    });
    appendChatMessage("bot", "Home Assistant conectado. Agora você pode importar entidades.");
    await loadDashboard();
  } catch (error) {
    window.alert(error.message || "Não foi possível conectar ao Home Assistant.");
  }
}

async function importHomeAssistantEntity() {
  try {
    const { entities } = await api("/api/integrations/home-assistant/entities");
    if (!entities.length) {
      window.alert("Nenhuma entidade compatível encontrada. Procure por luzes, switches, fans, covers, locks, media players ou aspiradores.");
      return;
    }
    const preview = entities.slice(0, 40).map((entity, index) =>
      `${index + 1}. ${entity.name} (${entity.entity_id}) - ${entity.state}`
    ).join("\n");
    const choice = window.prompt(`Escolha o número da entidade para importar:\n\n${preview}`);
    if (!choice) return;
    const entity = entities[Number(choice) - 1];
    if (!entity) {
      window.alert("Número inválido.");
      return;
    }
    const room = window.prompt("Cômodo desse dispositivo", "");
    await api("/api/integrations/home-assistant/import", {
      method: "POST",
      body: JSON.stringify({ entity_id: entity.entity_id, name: entity.name, room: room || "" }),
    });
    appendChatMessage("bot", `${entity.name} foi importado para seus dispositivos.`);
    await loadDashboard();
  } catch (error) {
    window.alert(error.message || "Não foi possível importar entidades do Home Assistant.");
  }
}

$("#importHomeAssistant").addEventListener("click", importHomeAssistantEntity);
$("#syncHomeAssistant").addEventListener("click", async () => {
  try {
    const result = await api("/api/integrations/home-assistant/sync", { method: "POST" });
    appendChatMessage("bot", `${result.synced} dispositivo(s) sincronizado(s) com o Home Assistant.`);
    await loadDashboard();
  } catch (error) {
    window.alert(error.message || "Não foi possível sincronizar o Home Assistant.");
  }
});

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
  media: {
    title: "Adicionar à biblioteca", endpoint: "/api/media",
    fields: [
      ["title", "Título", "text", "Back in Black"],
      ["artist", "Artista", "text", "AC/DC"],
      ["album", "Álbum ou playlist", "text", "Back in Black"],
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

function appendChatMessage(role, text, className = "") {
  const item = document.createElement("div");
  item.className = `chat-message ${role} ${className}`.trim();
  item.textContent = text;
  $("#chatMessages").appendChild(item);
  $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
  return item;
}

function setHearingText(text) {
  const element = $("#hearingText");
  element.hidden = !text;
  element.textContent = text ? `Ouvindo: ${text}` : "";
}

function scheduledActions() {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULED_ACTIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveScheduledActions(items) {
  localStorage.setItem(SCHEDULED_ACTIONS_KEY, JSON.stringify(items));
}

function parseScheduleTime(text) {
  const lower = text.toLowerCase();
  const match = lower.match(/\b(?:as|às|para|em)\s+(\d{1,2})(?::|h)?(\d{2})?\b/);
  if (!match) return null;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2] || "0"), 0, 0);
  if (lower.includes("amanh")) date.setDate(date.getDate() + 1);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date;
}

function openUrl(url) {
  window.open(url, "_blank", "noopener");
}

function whatsappUrl(number, message) {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function musicUrl(query, provider = "youtube") {
  const encoded = encodeURIComponent(query);
  if (provider === "spotify") return `https://open.spotify.com/search/${encoded}`;
  return `https://music.youtube.com/search?q=${encoded}`;
}

function scheduleBrowserAction(action) {
  const items = scheduledActions();
  items.push({ ...action, id: crypto.randomUUID?.() || String(Date.now()) });
  saveScheduledActions(items);
}

function runScheduledBrowserActions() {
  const now = Date.now();
  const pending = [];
  for (const action of scheduledActions()) {
    if (new Date(action.runAt).getTime() <= now) {
      openUrl(action.url);
      appendChatMessage("bot", `Executando agendamento: ${action.label}`);
    } else {
      pending.push(action);
    }
  }
  saveScheduledActions(pending);
}

function handleBrowserAction(message) {
  const lower = message.toLowerCase();
  const runAt = parseScheduleTime(message);

  if (lower.includes("whatsapp") || lower.includes("zap")) {
    const number = message.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || "";
    const textMatch = message.match(/(?:mensagem|texto|dizendo|falar|enviar)\s+(.+?)(?:\s+\b(?:as|às|para|em)\s+\d{1,2}(?::|h)?\d{0,2}\b|$)/i);
    const body = (textMatch?.[1] || "").trim();
    if (!number || !body) return "Para WhatsApp, diga o número e a mensagem. Exemplo: enviar WhatsApp para 5511999999999 mensagem estou chegando às 18:30.";
    const url = whatsappUrl(number, body);
    if (runAt) {
      scheduleBrowserAction({ type: "whatsapp", url, runAt: runAt.toISOString(), label: `WhatsApp para ${number}` });
      return `Mensagem agendada para ${runAt.toLocaleString("pt-BR")}. No horário, vou abrir o WhatsApp com o texto pronto.`;
    }
    openUrl(url);
    return "Abrindo WhatsApp com a mensagem preenchida.";
  }

  if (lower.includes("tocar") || lower.includes("toque") || lower.includes("spotify") || lower.includes("youtube music")) {
    const provider = lower.includes("spotify") ? "spotify" : "youtube";
    const query = message
      .replace(/\b(jarvis|jarvix|jatrvis|javis|jarves|jarvez|jarvi)\b/gi, "")
      .replace(/\b(tocar|toque|coloque para tocar|coloca para tocar|spotify|youtube music|youtube musica|youtube música)\b/gi, "")
      .replace(/\b(?:as|às|para|em)\s+\d{1,2}(?::|h)?\d{0,2}\b/gi, "")
      .trim();
    if (!query) return "";
    const url = musicUrl(query, provider);
    if (runAt) {
      scheduleBrowserAction({ type: "music", url, runAt: runAt.toISOString(), label: `${query} no ${provider === "spotify" ? "Spotify" : "YouTube Music"}` });
      return `Música agendada para ${runAt.toLocaleString("pt-BR")}. No horário, vou abrir ${provider === "spotify" ? "Spotify" : "YouTube Music"} com ${query}.`;
    }
    openUrl(url);
    return `Abrindo ${provider === "spotify" ? "Spotify" : "YouTube Music"} com ${query}.`;
  }

  return "";
}

async function askJarvix(message, options = {}) {
  const cleanMessage = message.trim();
  if (!cleanMessage) return;
  if (options.showUser !== false) appendChatMessage("user", cleanMessage);
  const localAction = handleBrowserAction(cleanMessage);
  if (localAction) {
    appendChatMessage("bot", localAction);
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(localAction));
    }
    return;
  }
  const pending = appendChatMessage("bot", "Pensando...", "pending");
  try {
    const result = await api("/api/assistant/chat", { method: "POST", body: JSON.stringify({ message: cleanMessage }) });
    pending.classList.remove("pending");
    pending.textContent = result.text;
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(result.text));
    }
  } catch {
    pending.classList.remove("pending");
    pending.textContent = "Não consegui responder agora. Verifique a configuração do servidor.";
  }
}

window.setInterval(runScheduledBrowserActions, 15000);

$("#chatForm").addEventListener("submit", event => {
  event.preventDefault();
  const input = $("#chatInput");
  if (input.value.trim()) askJarvix(input.value.trim());
  input.value = "";
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  let voiceEnabled = false;
  let recognitionRunning = false;
  let lastVoiceTranscript = "";
  recognition.lang = "pt-BR";
  recognition.continuous = true;
  recognition.interimResults = true;

  function startVoiceLoop() {
    if (!voiceEnabled || recognitionRunning) return;
    try {
      recognition.start();
    } catch {}
  }

  function stopVoiceLoop() {
    voiceEnabled = false;
    try {
      recognition.stop();
    } catch {}
    $("#voiceButton").classList.remove("listening");
    $("#voiceState").textContent = "Toque para falar";
    setHearingText("");
  }

  function extractJarvixCommand(text) {
    const lower = text.toLowerCase();
    const wake = WAKE_WORDS.find(word => lower.includes(word));
    if (!wake) return "";
    const index = lower.indexOf(wake);
    const before = text.slice(0, index).replace(/^[\s,.!?;:-]+|[\s,.!?;:-]+$/g, "");
    const after = text.slice(index + wake.length).replace(/^[\s,.!?;:-]+|[\s,.!?;:-]+$/g, "");
    return after || before || "Sim?";
  }

  recognition.onstart = () => {
    recognitionRunning = true;
    $("#voiceButton").classList.add("listening");
    $("#voiceState").textContent = "Ouvindo Jarvis...";
  };
  recognition.onend = () => {
    recognitionRunning = false;
    if (voiceEnabled) window.setTimeout(startVoiceLoop, 250);
    else {
      $("#voiceButton").classList.remove("listening");
      $("#voiceState").textContent = "Toque para falar";
      setHearingText("");
    }
  };
  recognition.onerror = () => {
    recognitionRunning = false;
    if (voiceEnabled) window.setTimeout(startVoiceLoop, 700);
  };
  recognition.onresult = event => {
    let transcript = "";
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) transcript += event.results[index][0].transcript;
      else interim += event.results[index][0].transcript;
    }
    transcript = transcript.trim();
    interim = interim.trim();
    setHearingText(interim || transcript);
    if (!transcript) return;
    if (transcript === lastVoiceTranscript) return;
    lastVoiceTranscript = transcript;
    const command = extractJarvixCommand(transcript);
    if (!command) return;
    setHearingText("");
    appendChatMessage("user", transcript);
    askJarvix(command || "Sim?", { showUser: false });
  };
  $("#voiceButton").addEventListener("click", () => {
    voiceEnabled = !voiceEnabled;
    if (voiceEnabled) {
      $("#voiceState").textContent = "Ouvindo Jarvis...";
      startVoiceLoop();
    } else {
      stopVoiceLoop();
    }
  });
} else {
  $("#voiceButton").addEventListener("click", () => $("#voiceState").textContent = "Reconhecimento de voz indisponível neste navegador");
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
startApp();
