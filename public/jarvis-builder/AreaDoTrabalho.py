from __future__ import annotations

from pathlib import Path


def caminho_area_do_trabalho() -> Path:
    return Path.home() / "Desktop"


def salvar_na_area_do_trabalho(nome_arquivo: str, conteudo: str) -> str:
    destino = caminho_area_do_trabalho() / nome_arquivo
    destino.write_text(conteudo, encoding="utf-8")
    return str(destino)
