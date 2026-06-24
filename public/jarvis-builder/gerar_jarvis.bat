@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Jarvis Builder

set "LOG_FILE=%~dp0build_jarvis.log"
set "ICON_PATH=C:\Users\FOTOGRAFIA\AppData\Roaming\JetBrains\PyCharm2025.1\scratches\jarvis.ico"
set "REQ_FILE=%~dp0requirements-builder.txt"
set "VENV_DIR=%~dp0.jarvis-build-venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
set "BASE_PY="
set "PY_CMD="

echo ===== Jarvis Builder ===== > "%LOG_FILE%"
echo Data/Hora: %date% %time% >> "%LOG_FILE%"
echo Pasta: %cd% >> "%LOG_FILE%"

echo.
echo ===== Jarvis Builder =====
echo Pasta: %cd%
echo Log: "%LOG_FILE%"
echo.

call :STATUS "[1/6] Procurando Python instalado..."
call :TRY_PYTHON "py -3.13"
if not defined BASE_PY call :TRY_PYTHON "py -3.12"
if not defined BASE_PY call :TRY_PYTHON "py -3.11"
if not defined BASE_PY call :TRY_PYTHON "py -3.10"
if not defined BASE_PY call :TRY_PYTHON "py -3"
if not defined BASE_PY call :TRY_PYTHON "python"

if not defined BASE_PY (
	call :STATUS "[ERRO] Nao encontrei Python funcional."
	echo.
	echo Instale o Python 3 pelo site python.org e marque "Add python.exe to PATH".
	echo Detalhes em: "%LOG_FILE%"
	pause
	exit /b 1
)

call :STATUS "[OK] Python base encontrado: %BASE_PY%"

if not exist "main.py" (
	call :STATUS "[ERRO] main.py nao encontrado nesta pasta."
	goto BUILD_ERROR
)

if not exist "%VENV_PY%" (
	call :STATUS "[2/6] Criando ambiente local do Jarvis. Isso pode levar alguns minutos..."
	%BASE_PY% -m venv "%VENV_DIR%" >> "%LOG_FILE%" 2>&1
	if errorlevel 1 (
		call :STATUS "[ERRO] Nao foi possivel criar o ambiente local."
		goto BUILD_ERROR
	)
) else (
	call :STATUS "[2/6] Ambiente local ja existe. Reutilizando..."
)

"%VENV_PY%" -m pip --version >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
	call :STATUS "[2/6] pip nao encontrado no ambiente local. Tentando corrigir..."
	"%VENV_PY%" -m ensurepip --upgrade >> "%LOG_FILE%" 2>&1
	"%VENV_PY%" -m pip --version >> "%LOG_FILE%" 2>&1
)
if errorlevel 1 (
	call :STATUS "[ERRO] pip indisponivel no ambiente local."
	goto BUILD_ERROR
)

set "PY_CMD=%VENV_PY%"
call :STATUS "[3/6] Atualizando pip/setuptools/wheel..."
"%PY_CMD%" -m pip install --upgrade pip setuptools wheel >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
	call :STATUS "[ERRO] Nao foi possivel atualizar pip/setuptools/wheel."
	goto BUILD_ERROR
)

if exist "%REQ_FILE%" (
	call :STATUS "[4/6] Instalando dependencias do Jarvis. Esta etapa pode demorar..."
	"%PY_CMD%" -m pip install -r "%REQ_FILE%" >> "%LOG_FILE%" 2>&1
) else (
	call :STATUS "[4/6] requirements-builder.txt nao encontrado. Instalando dependencias minimas..."
	"%PY_CMD%" -m pip install pyinstaller openai python-dotenv requests chromadb SpeechRecognition edge-tts pygame PyAudio >> "%LOG_FILE%" 2>&1
)
if errorlevel 1 (
	call :STATUS "[ERRO] Falha ao instalar dependencias."
	goto BUILD_ERROR
)

"%PY_CMD%" -m PyInstaller --version >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
	call :STATUS "[ERRO] PyInstaller nao esta disponivel mesmo apos instalacao."
	goto BUILD_ERROR
)

set "ICON_ARG="
if exist "%ICON_PATH%" (
	set "ICON_ARG=--icon=%ICON_PATH%"
	call :STATUS "[OK] Icone encontrado."
) else (
	call :STATUS "[AVISO] Icone nao encontrado. Gerando sem icone."
)

call :STATUS "[5/6] Limpando builds anteriores..."
if exist "build" rmdir /s /q "build" >> "%LOG_FILE%" 2>&1
if exist "dist\Jarvis" rmdir /s /q "dist\Jarvis" >> "%LOG_FILE%" 2>&1

call :STATUS "[6/6] Gerando executavel com PyInstaller. Aguarde..."
"%PY_CMD%" -m PyInstaller --onedir --name Jarvis !ICON_ARG! --hidden-import chromadb.telemetry.product.posthog --collect-all chromadb --collect-all numpy --collect-all pygame main.py >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto BUILD_ERROR

echo.
echo [OK] Executavel gerado com sucesso em: dist\Jarvis
echo Log completo: "%LOG_FILE%"
pause
exit /b 0

:TRY_PYTHON
if defined BASE_PY exit /b 0
set "CANDIDATE=%~1"
echo Testando Python: %CANDIDATE% >> "%LOG_FILE%"
echo   - %CANDIDATE%
%CANDIDATE% -c "import sys, venv; print(sys.executable)" >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
	echo Python indisponivel: %CANDIDATE% >> "%LOG_FILE%"
	exit /b 0
)
set "BASE_PY=%CANDIDATE%"
exit /b 0

:STATUS
echo %~1
echo %~1 >> "%LOG_FILE%"
exit /b 0

:BUILD_ERROR
echo.
echo [ERRO] A geracao falhou.
echo Veja o arquivo de log: "%LOG_FILE%"
echo.
type "%LOG_FILE%"
pause
exit /b 1
