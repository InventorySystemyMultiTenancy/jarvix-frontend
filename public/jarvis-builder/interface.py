from __future__ import annotations

import tkinter as tk
from tkinter import messagebox

import main


def abrir_interface() -> None:
    janela = tk.Tk()
    janela.title("Jarvis")
    janela.geometry("720x520")

    tk.Label(janela, text="Jarvis", font=("Segoe UI", 20, "bold")).pack(pady=14)
    tk.Label(
        janela,
        text="Use o main.py para conversar com a central, salvar memória local e sincronizar dados do usuário.",
        wraplength=620,
        justify="center",
    ).pack(pady=8)

    entrada = tk.Entry(janela, width=72)
    entrada.pack(padx=18, pady=10)

    saida = tk.Text(janela, height=16, wrap="word")
    saida.pack(fill="both", expand=True, padx=18, pady=10)

    def registrar_texto() -> None:
        texto = entrada.get().strip()
        if not texto:
            return
        entrada.delete(0, tk.END)
        try:
            resposta = main.executar_jarvis(texto)
        except Exception as erro:
            resposta = f"Erro ao executar Jarvis: {erro}"
        saida.insert(tk.END, f"> {texto}\n{resposta}\n\n")
        saida.see(tk.END)

    tk.Button(janela, text="Enviar", command=registrar_texto).pack(pady=8)
    tk.Button(
        janela,
        text="Salvar lembrete de teste",
        command=lambda: messagebox.showinfo(
            "Jarvis",
            main.criar_lembrete("Teste", "01/01/2099 10:00", "Lembrete criado pela interface"),
        ),
    ).pack(pady=4)

    janela.mainloop()


if __name__ == "__main__":
    abrir_interface()
