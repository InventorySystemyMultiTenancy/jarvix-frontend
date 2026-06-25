from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
import queue
import tempfile
import threading
import tkinter as tk
from tkinter import messagebox, ttk

import edge_tts
import pygame
import requests
import speech_recognition as sr


APP_DIR = Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "Jarvis"
APP_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_FILE = APP_DIR / "config.json"


def app_base_dir() -> Path:
    import sys

    return Path(sys.executable if getattr(sys, "frozen", False) else __file__).resolve().parent


def load_runtime_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for path in (app_base_dir() / "jarvis_runtime.env", app_base_dir() / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


RUNTIME_ENV = load_runtime_env()
DEFAULT_CENTRAL_URL = (
    RUNTIME_ENV.get("JARVIS_CENTRAL_URL")
    or os.getenv("JARVIS_CENTRAL_URL")
    or "http://127.0.0.1:8765"
).rstrip("/")
WAKE_WORDS = ("jarvis", "jarvix", "jatrvis", "javis", "jarves", "jarvez", "jarvi")


class JarvisClient:
    def __init__(self) -> None:
        self.config = self.load_config()
        self.central_url = (self.config.get("central_url") or DEFAULT_CENTRAL_URL).rstrip("/")
        self.token = self.config.get("central_token", "")
        self.email = self.config.get("email", "")

    def load_config(self) -> dict:
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def save_config(self) -> None:
        CONFIG_FILE.write_text(
            json.dumps(
                {
                    "central_url": self.central_url,
                    "central_token": self.token,
                    "email": self.email,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def login(self, url: str, email: str, password: str) -> None:
        self.central_url = url.rstrip("/")
        response = requests.post(
            f"{self.central_url}/api/auth/login",
            json={"email": email.strip(), "password": password},
            timeout=25,
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["access_token"]
        self.email = email.strip()
        self.save_config()

    def ask(self, message: str) -> str:
        response = requests.post(
            f"{self.central_url}/api/assistant/chat",
            json={"message": message},
            headers=self.headers(),
            timeout=70,
        )
        if response.status_code == 401:
            self.token = ""
            self.save_config()
            raise RuntimeError("Sessao expirada. Entre novamente.")
        response.raise_for_status()
        data = response.json()
        return data.get("text") or "Recebi uma resposta vazia da central."


class JarvisApp:
    def __init__(self) -> None:
        self.client = JarvisClient()
        self.root = tk.Tk()
        self.root.title("Jarvis")
        self.root.geometry("980x680")
        self.root.minsize(760, 540)
        self.root.configure(bg="#06100e")

        self.messages: queue.Queue[tuple[str, str]] = queue.Queue()
        self.recognizer = sr.Recognizer()
        self.listening = False
        self.listen_thread: threading.Thread | None = None
        self.audio_ready = self.init_audio()

        self.status_text = tk.StringVar(value="Conecte sua conta Jarvis" if not self.client.token else "Jarvis online")
        self.hearing_text = tk.StringVar(value="Microfone desligado")

        self.build_style()
        self.build_ui()
        self.root.after(120, self.drain_messages)
        if not self.client.token:
            self.show_login()
        else:
            self.add_message("bot", "Estou pronto. Clique no microfone e diga Jarvis seguido do comando.")

    def init_audio(self) -> bool:
        try:
            pygame.mixer.init()
            return True
        except Exception:
            return False

    def build_style(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Root.TFrame", background="#06100e")
        style.configure("Panel.TFrame", background="#0b1815")
        style.configure("Title.TLabel", background="#06100e", foreground="#edfdf7", font=("Segoe UI", 24, "bold"))
        style.configure("Muted.TLabel", background="#06100e", foreground="#88a49a", font=("Segoe UI", 10))
        style.configure("PanelMuted.TLabel", background="#0b1815", foreground="#88a49a", font=("Segoe UI", 10))
        style.configure("Primary.TButton", background="#78f8c6", foreground="#052018", borderwidth=0, font=("Segoe UI", 10, "bold"))
        style.map("Primary.TButton", background=[("active", "#a2ffda")])

    def build_ui(self) -> None:
        shell = ttk.Frame(self.root, style="Root.TFrame", padding=22)
        shell.pack(fill="both", expand=True)

        header = ttk.Frame(shell, style="Root.TFrame")
        header.pack(fill="x")
        ttk.Label(header, text="Jarvis", style="Title.TLabel").pack(side="left")
        ttk.Label(header, textvariable=self.status_text, style="Muted.TLabel").pack(side="right", padx=6)

        body = ttk.Frame(shell, style="Root.TFrame")
        body.pack(fill="both", expand=True, pady=(18, 0))

        left = ttk.Frame(body, style="Panel.TFrame", padding=18)
        left.pack(side="left", fill="y", padx=(0, 16))

        self.mic_button = tk.Button(
            left,
            text="●",
            width=7,
            height=3,
            bg="#10231e",
            fg="#78f8c6",
            activebackground="#163f34",
            activeforeground="#baffdf",
            relief="flat",
            font=("Segoe UI", 34, "bold"),
            command=self.toggle_listening,
        )
        self.mic_button.pack(pady=(18, 14))
        ttk.Label(left, textvariable=self.hearing_text, style="PanelMuted.TLabel", wraplength=190, justify="center").pack(pady=8)
        ttk.Button(left, text="Conta", style="Primary.TButton", command=self.show_login).pack(fill="x", pady=(24, 8))
        ttk.Button(left, text="Limpar chat", command=self.clear_chat).pack(fill="x")

        right = ttk.Frame(body, style="Panel.TFrame", padding=14)
        right.pack(side="left", fill="both", expand=True)

        self.chat = tk.Text(
            right,
            wrap="word",
            bg="#07120f",
            fg="#edfdf7",
            insertbackground="#78f8c6",
            relief="flat",
            padx=14,
            pady=14,
            font=("Segoe UI", 11),
            state="disabled",
        )
        self.chat.pack(fill="both", expand=True)
        self.chat.tag_configure("user", foreground="#78f8c6", spacing3=10)
        self.chat.tag_configure("bot", foreground="#edfdf7", spacing3=10)
        self.chat.tag_configure("system", foreground="#88a49a", spacing3=10)

        form = ttk.Frame(right, style="Panel.TFrame")
        form.pack(fill="x", pady=(12, 0))
        self.entry = tk.Entry(form, bg="#081410", fg="#edfdf7", insertbackground="#78f8c6", relief="flat", font=("Segoe UI", 11))
        self.entry.pack(side="left", fill="x", expand=True, ipady=10, padx=(0, 10))
        self.entry.bind("<Return>", lambda _: self.send_from_entry())
        ttk.Button(form, text="Enviar", style="Primary.TButton", command=self.send_from_entry).pack(side="right")

    def show_login(self) -> None:
        dialog = tk.Toplevel(self.root)
        dialog.title("Conectar Jarvis")
        dialog.geometry("560x430")
        dialog.minsize(520, 400)
        dialog.configure(bg="#0b1815")
        dialog.transient(self.root)
        dialog.grab_set()

        frame = ttk.Frame(dialog, style="Panel.TFrame", padding=20)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Conectar conta Jarvis", style="PanelMuted.TLabel", font=("Segoe UI", 14, "bold")).pack(anchor="w", pady=(0, 14))
        ttk.Label(
            frame,
            text="Use a URL do backend publicado. 127.0.0.1 funciona apenas se o servidor estiver rodando neste computador.",
            style="PanelMuted.TLabel",
            wraplength=500,
        ).pack(anchor="w", pady=(0, 10))

        url = self.login_field(frame, "URL da central", self.client.central_url)
        email = self.login_field(frame, "E-mail", self.client.email)
        password = self.login_field(frame, "Senha", "", show="*")

        def submit() -> None:
            try:
                central_url = url.get().strip()
                if central_url.startswith("http://127.0.0.1") or central_url.startswith("http://localhost"):
                    if not messagebox.askyesno(
                        "Jarvis",
                        "A URL informada e local. Ela so funciona se o backend estiver aberto neste computador. Deseja continuar?",
                        parent=dialog,
                    ):
                        return
                self.client.login(central_url, email.get().strip(), password.get())
                self.status_text.set("Jarvis online")
                self.add_message("system", "Conta conectada com sucesso.")
                dialog.destroy()
            except Exception as exc:
                messagebox.showerror("Jarvis", f"Nao foi possivel conectar:\n{exc}", parent=dialog)

        buttons = ttk.Frame(frame, style="Panel.TFrame")
        buttons.pack(fill="x", side="bottom", pady=(18, 0))
        ttk.Button(buttons, text="Conectar", style="Primary.TButton", command=submit).pack(side="right", ipadx=18)
        ttk.Button(buttons, text="Cancelar", command=dialog.destroy).pack(side="right", padx=(0, 10), ipadx=14)
        dialog.bind("<Return>", lambda _: submit())
        password.focus_set()

    def login_field(self, parent: ttk.Frame, label: str, value: str, show: str = "") -> tk.Entry:
        ttk.Label(parent, text=label, style="PanelMuted.TLabel").pack(anchor="w", pady=(8, 4))
        entry = tk.Entry(parent, bg="#081410", fg="#edfdf7", insertbackground="#78f8c6", relief="flat", show=show)
        entry.insert(0, value)
        entry.pack(fill="x", ipady=8)
        return entry

    def add_message(self, role: str, text: str) -> None:
        prefix = {"user": "Voce", "bot": "Jarvis", "system": "Sistema"}.get(role, role)
        self.chat.configure(state="normal")
        self.chat.insert("end", f"{prefix}: {text}\n\n", role)
        self.chat.see("end")
        self.chat.configure(state="disabled")

    def clear_chat(self) -> None:
        self.chat.configure(state="normal")
        self.chat.delete("1.0", "end")
        self.chat.configure(state="disabled")

    def send_from_entry(self) -> None:
        message = self.entry.get().strip()
        if not message:
            return
        self.entry.delete(0, "end")
        self.send_message(message)

    def send_message(self, message: str) -> None:
        self.add_message("user", message)
        self.add_message("bot", "Pensando...")
        threading.Thread(target=self.ask_worker, args=(message,), daemon=True).start()

    def ask_worker(self, message: str) -> None:
        try:
            answer = self.client.ask(message)
            self.messages.put(("answer", answer))
            self.speak(answer)
        except Exception as exc:
            self.messages.put(("answer", f"Nao consegui responder agora: {exc}"))

    def speak(self, text: str) -> None:
        if not self.audio_ready:
            return
        try:
            async def generate() -> str:
                temp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
                temp.close()
                communicate = edge_tts.Communicate(text=text, voice="pt-BR-AntonioNeural")
                await communicate.save(temp.name)
                return temp.name

            path = asyncio.run(generate())
            pygame.mixer.music.load(path)
            pygame.mixer.music.play()
        except Exception:
            return

    def toggle_listening(self) -> None:
        self.listening = not self.listening
        if self.listening:
            self.mic_button.configure(bg="#78f8c6", fg="#052018")
            self.hearing_text.set("Ouvindo Jarvis...")
            self.listen_thread = threading.Thread(target=self.listen_loop, daemon=True)
            self.listen_thread.start()
        else:
            self.mic_button.configure(bg="#10231e", fg="#78f8c6")
            self.hearing_text.set("Microfone desligado")

    def listen_loop(self) -> None:
        while self.listening:
            try:
                with sr.Microphone() as source:
                    self.recognizer.adjust_for_ambient_noise(source, duration=0.4)
                    audio = self.recognizer.listen(source, timeout=4, phrase_time_limit=8)
                text = self.recognizer.recognize_google(audio, language="pt-BR").strip()
                self.messages.put(("heard", text))
                command = self.extract_command(text)
                if command:
                    self.messages.put(("send", command))
            except sr.WaitTimeoutError:
                continue
            except sr.UnknownValueError:
                self.messages.put(("hearing", "Nao entendi. Continue falando."))
            except Exception as exc:
                self.messages.put(("hearing", f"Microfone: {exc}"))

    def extract_command(self, text: str) -> str:
        lower = text.lower()
        for wake in WAKE_WORDS:
            if wake in lower:
                index = lower.find(wake)
                before = text[:index].strip(" ,.!?;:-")
                after = text[index + len(wake):].strip(" ,.!?;:-")
                return after or before or "Sim?"
        return ""

    def drain_messages(self) -> None:
        while True:
            try:
                kind, text = self.messages.get_nowait()
            except queue.Empty:
                break
            if kind == "heard":
                self.hearing_text.set(f"Ouvindo: {text}")
            elif kind == "hearing":
                self.hearing_text.set(text)
            elif kind == "send":
                self.send_message(text)
            elif kind == "answer":
                self.add_message("bot", text)
        self.root.after(120, self.drain_messages)

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    JarvisApp().run()
