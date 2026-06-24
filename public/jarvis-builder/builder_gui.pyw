from __future__ import annotations

import os
import queue
import shutil
import subprocess
import sys
import threading
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, ttk


ROOT = Path(__file__).resolve().parent
LOG_FILE = ROOT / "build_jarvis.log"
REQ_FILE = ROOT / "requirements-builder.txt"
VENV_DIR = ROOT / ".jarvis-build-venv"
VENV_PY = VENV_DIR / "Scripts" / "python.exe"
ICON_PATH = Path(r"C:\Users\FOTOGRAFIA\AppData\Roaming\JetBrains\PyCharm2025.1\scratches\jarvis.ico")
MIN_FREE_BEFORE_INSTALL = 4 * 1024 * 1024 * 1024
MIN_FREE_BEFORE_BUILD = 2 * 1024 * 1024 * 1024


class BuilderApp:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Jarvis Builder")
        self.root.geometry("760x520")
        self.root.minsize(680, 460)
        self.messages: queue.Queue[tuple[str, object]] = queue.Queue()
        self.running = False
        self.finished = False

        self.status = tk.StringVar(value="Pronto para gerar o Jarvis.")
        self.detail = tk.StringVar(value=f"Pasta: {ROOT}")
        self.progress = tk.IntVar(value=0)

        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.after(100, self._drain_messages)

    def _build_ui(self) -> None:
        self.root.configure(bg="#f6f7fb")
        frame = ttk.Frame(self.root, padding=18)
        frame.pack(fill="both", expand=True)

        title = ttk.Label(frame, text="Jarvis Builder", font=("Segoe UI", 20, "bold"))
        title.pack(anchor="w")

        subtitle = ttk.Label(
            frame,
            text="Gere o executavel do Jarvis com acompanhamento da instalacao.",
            font=("Segoe UI", 10),
        )
        subtitle.pack(anchor="w", pady=(2, 16))

        ttk.Label(frame, textvariable=self.status, font=("Segoe UI", 11, "bold")).pack(anchor="w")
        ttk.Label(frame, textvariable=self.detail, font=("Segoe UI", 9)).pack(anchor="w", pady=(2, 10))

        self.bar = ttk.Progressbar(frame, maximum=100, variable=self.progress)
        self.bar.pack(fill="x", pady=(0, 14))

        log_frame = ttk.Frame(frame)
        log_frame.pack(fill="both", expand=True)
        self.log = tk.Text(log_frame, height=15, wrap="word", font=("Consolas", 9), state="disabled")
        scroll = ttk.Scrollbar(log_frame, command=self.log.yview)
        self.log.configure(yscrollcommand=scroll.set)
        self.log.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", pady=(14, 0))
        self.start_button = ttk.Button(buttons, text="Gerar Jarvis", command=self.start)
        self.start_button.pack(side="left")
        ttk.Button(buttons, text="Abrir log", command=self.open_log).pack(side="left", padx=8)
        ttk.Button(buttons, text="Sair", command=self._on_close).pack(side="right")

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self.finished = False
        self.progress.set(0)
        self.start_button.configure(state="disabled")
        self._set_log("")
        thread = threading.Thread(target=self._run_build, daemon=True)
        thread.start()

    def open_log(self) -> None:
        if not LOG_FILE.exists():
            LOG_FILE.write_text("", encoding="utf-8")
        os.startfile(LOG_FILE)

    def _run_build(self) -> None:
        try:
            self._write_log_header()
            self._step(5, "Procurando Python instalado...", str(ROOT))
            base_python = self._find_python()
            if not base_python:
                raise RuntimeError("Nao encontrei Python funcional. Instale Python 3 pelo site python.org.")

            self._log(f"Python base encontrado: {' '.join(base_python)}")
            app_py = ROOT / "jarvis_app.py"
            if not app_py.exists():
                raise RuntimeError(f"jarvis_app.py nao encontrado em {ROOT}")

            self._check_free_space(MIN_FREE_BEFORE_INSTALL, "instalar as dependencias")

            self._step(18, "Criando ambiente local do Jarvis...", "Pode levar alguns minutos na primeira execucao.")
            if not VENV_PY.exists():
                self._run(base_python + ["-m", "venv", str(VENV_DIR)])
            else:
                self._log("Ambiente local ja existe. Reutilizando.")

            self._step(32, "Verificando pip no ambiente local...", str(VENV_PY))
            if self._run([str(VENV_PY), "-m", "pip", "--version"], check=False) != 0:
                self._run([str(VENV_PY), "-m", "ensurepip", "--upgrade"])

            self._step(45, "Atualizando ferramentas de instalacao...", "pip, setuptools e wheel")
            self._run([str(VENV_PY), "-m", "pip", "install", "--no-cache-dir", "--upgrade", "pip", "setuptools", "wheel"])

            self._step(62, "Instalando dependencias do Jarvis...", "Esta etapa pode demorar.")
            if REQ_FILE.exists():
                self._run([str(VENV_PY), "-m", "pip", "install", "--no-cache-dir", "-r", str(REQ_FILE)])
            else:
                self._run([
                    str(VENV_PY),
                    "-m",
                    "pip",
                    "install",
                    "--no-cache-dir",
                    "pyinstaller",
                    "openai",
                    "python-dotenv",
                    "requests",
                    "chromadb",
                    "SpeechRecognition",
                    "edge-tts",
                    "pygame",
                    "PyAudio",
                ])

            self._check_free_space(MIN_FREE_BEFORE_BUILD, "gerar o executavel")

            self._step(78, "Preparando build...", "Limpando builds anteriores.")
            self._run([str(VENV_PY), "-m", "PyInstaller", "--version"])
            shutil.rmtree(ROOT / "build", ignore_errors=True)
            shutil.rmtree(ROOT / "dist" / "Jarvis", ignore_errors=True)

            args = [
                str(VENV_PY),
                "-m",
                "PyInstaller",
                "--windowed",
                "--onedir",
                "--name",
                "Jarvis",
                "--collect-all",
                "pygame",
                "jarvis_app.py",
            ]
            if ICON_PATH.exists():
                args[3:3] = [f"--icon={ICON_PATH}"]
                self._log(f"Icone encontrado: {ICON_PATH}")
            else:
                self._log("Icone nao encontrado. Gerando sem icone.")

            self._step(88, "Gerando executavel com PyInstaller...", "Aguarde ate terminar.")
            self._run(args, cwd=ROOT)

            env_file = ROOT / ".env"
            final_env = ROOT / "dist" / "Jarvis" / ".env"
            if env_file.exists():
                self._copy_runtime_env(env_file, final_env)
                self._log(f"Arquivo .env seguro copiado para: {final_env}")
            else:
                self._log("Arquivo .env nao encontrado na pasta do Builder. Configure a central Jarvis em dist\\Jarvis\\.env.")

            self._step(100, "Jarvis gerado com sucesso.", str(ROOT / "dist" / "Jarvis"))
            self.messages.put(("done", True))
        except Exception as exc:
            self._log(f"ERRO: {exc}")
            self.messages.put(("error", str(exc)))

    def _find_python(self) -> list[str] | None:
        candidates = [
            ["py", "-3.13"],
            ["py", "-3.12"],
            ["py", "-3.11"],
            ["py", "-3.10"],
            ["py", "-3"],
            ["python"],
        ]
        for candidate in candidates:
            self._log(f"Testando Python: {' '.join(candidate)}")
            code = self._run(candidate + ["-c", "import sys, venv; print(sys.executable)"], check=False)
            if code == 0:
                return candidate
        return None

    def _copy_runtime_env(self, source: Path, target: Path) -> None:
        lines = source.read_text(encoding="utf-8", errors="ignore").splitlines()
        allow_local_openai = any(line.strip().lower() in {"jarvis_allow_local_openai=1", "jarvis_allow_local_openai=true"} for line in lines)
        safe_lines = []
        for line in lines:
            key = line.split("=", 1)[0].strip().upper() if "=" in line else ""
            if key == "OPENAI_API_KEY" and not allow_local_openai:
                continue
            safe_lines.append(line)
        target.write_text("\n".join(safe_lines) + "\n", encoding="utf-8")

    def _run(self, args: list[str], cwd: Path | None = None, check: bool = True) -> int:
        self._log(f"> {' '.join(map(str, args))}")
        startupinfo = None
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        process = subprocess.Popen(
            args,
            cwd=str(cwd or ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            startupinfo=startupinfo,
        )
        assert process.stdout is not None
        for line in process.stdout:
            self._log(line.rstrip())
        code = process.wait()
        if check and code != 0:
            raise RuntimeError(f"Comando falhou com codigo {code}: {' '.join(map(str, args))}")
        return code

    def _check_free_space(self, required_bytes: int, action: str) -> None:
        usage = shutil.disk_usage(ROOT)
        free_gb = usage.free / (1024 ** 3)
        required_gb = required_bytes / (1024 ** 3)
        self._log(f"Espaco livre em disco: {free_gb:.2f} GB")
        if usage.free < required_bytes:
            raise RuntimeError(
                f"Espaco insuficiente para {action}. "
                f"Disponivel: {free_gb:.2f} GB. Necessario: pelo menos {required_gb:.0f} GB livres. "
                "Libere espaco no disco C: e tente novamente."
            )

    def _step(self, progress: int, status: str, detail: str = "") -> None:
        self.messages.put(("progress", progress))
        self.messages.put(("status", status))
        self.messages.put(("detail", detail))
        self._log(status)

    def _log(self, text: str) -> None:
        with LOG_FILE.open("a", encoding="utf-8", errors="replace") as file:
            file.write(text + "\n")
        self.messages.put(("log", text + "\n"))

    def _write_log_header(self) -> None:
        LOG_FILE.write_text(
            "===== Jarvis Builder =====\n"
            f"Pasta: {ROOT}\n"
            f"Python da interface: {sys.executable}\n\n",
            encoding="utf-8",
        )

    def _drain_messages(self) -> None:
        while True:
            try:
                kind, value = self.messages.get_nowait()
            except queue.Empty:
                break
            if kind == "log":
                self._append_log(str(value))
            elif kind == "status":
                self.status.set(str(value))
            elif kind == "detail":
                self.detail.set(str(value))
            elif kind == "progress":
                self.progress.set(int(value))
            elif kind == "done":
                self.running = False
                self.finished = True
                self.start_button.configure(state="normal")
                messagebox.showinfo("Jarvis Builder", "Executavel gerado com sucesso em dist\\Jarvis.")
            elif kind == "error":
                self.running = False
                self.start_button.configure(state="normal")
                messagebox.showerror("Jarvis Builder", f"A geracao falhou.\n\n{value}\n\nVeja o build_jarvis.log.")
        self.root.after(100, self._drain_messages)

    def _append_log(self, text: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", text)
        self.log.see("end")
        self.log.configure(state="disabled")

    def _set_log(self, text: str) -> None:
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        if text:
            self.log.insert("end", text)
        self.log.configure(state="disabled")

    def _on_close(self) -> None:
        if self.running and not messagebox.askyesno("Jarvis Builder", "A instalacao ainda esta em andamento. Deseja sair mesmo assim?"):
            return
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    BuilderApp().run()
