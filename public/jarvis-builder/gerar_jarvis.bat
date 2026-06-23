@echo off
setlocal
cd /d "%~dp0"
python -m PyInstaller --onedir --name Jarvis --icon="C:\Users\FOTOGRAFIA\AppData\Roaming\JetBrains\PyCharm2025.1\scratches\jarvis.ico" --hidden-import chromadb.telemetry.product.posthog --collect-all chromadb --collect-all numpy main.py
pause
