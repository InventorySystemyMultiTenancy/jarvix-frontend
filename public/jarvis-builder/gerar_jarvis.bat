@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "LOG_FILE=%~dp0build_jarvis.log"
set "ICON_PATH=C:\Users\FOTOGRAFIA\AppData\Roaming\JetBrains\PyCharm2025.1\scratches\jarvis.ico"
set "REQ_FILE=%~dp0requirements-builder.txt"
set "PY_CMD="

echo ===== Jarvis Builder ===== > "%LOG_FILE%"
echo Data/Hora: %date% %time% >> "%LOG_FILE%"
echo Pasta: %cd% >> "%LOG_FILE%"

call :TRY_PYTHON "py -3.12"
if not defined PY_CMD call :TRY_PYTHON "py -3.11"
if not defined PY_CMD call :TRY_PYTHON "py -3.10"
if not defined PY_CMD call :TRY_PYTHON "py -3.13"
if not defined PY_CMD call :TRY_PYTHON "py -3"
if not defined PY_CMD call :TRY_PYTHON "python"

if not defined PY_CMD (
	echo ERRO: Python com pip nao encontrado. >> "%LOG_FILE%"
	echo.
	echo [ERRO] Nao encontrei um Python funcional com pip.
	echo Instale o Python 3.12 pelo site python.org e marque "Add python.exe to PATH".
	echo Depois execute este arquivo novamente.
	echo.
	echo Detalhes em: "%LOG_FILE%"
	pause
	exit /b 1
)

echo Usando comando Python: %PY_CMD% >> "%LOG_FILE%"
%PY_CMD% --version >> "%LOG_FILE%" 2>&1

echo Atualizando pip/setuptools/wheel... >> "%LOG_FILE%"
%PY_CMD% -m pip install --upgrade pip setuptools wheel >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
	echo ERRO: nao foi possivel atualizar pip/setuptools/wheel. >> "%LOG_FILE%"
	goto BUILD_ERROR
)

if exist "%REQ_FILE%" (
	echo Instalando dependencias de requirements-builder.txt... >> "%LOG_FILE%"
	%PY_CMD% -m pip install -r "%REQ_FILE%" >> "%LOG_FILE%" 2>&1
) else (
	echo requirements-builder.txt nao encontrado. Instalando dependencias minimas... >> "%LOG_FILE%"
	%PY_CMD% -m pip install pyinstaller openai python-dotenv requests chromadb SpeechRecognition edge-tts pygame PyAudio >> "%LOG_FILE%" 2>&1
)

if errorlevel 1 (
	echo ERRO: falha ao instalar dependencias. >> "%LOG_FILE%"
	goto BUILD_ERROR
)

%PY_CMD% -m PyInstaller --version >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
	echo ERRO: PyInstaller nao esta disponivel mesmo apos instalacao. >> "%LOG_FILE%"
	goto BUILD_ERROR
)

set "ICON_ARG="
if exist "%ICON_PATH%" (
	set "ICON_ARG=--icon=%ICON_PATH%"
	echo Icone encontrado em %ICON_PATH% >> "%LOG_FILE%"
) else (
	echo Icone nao encontrado em %ICON_PATH%. Gerando sem icone. >> "%LOG_FILE%"
)

if not exist "main.py" (
	echo ERRO: main.py nao encontrado em %cd%. >> "%LOG_FILE%"
	goto BUILD_ERROR
)

echo Limpando builds anteriores... >> "%LOG_FILE%"
if exist "build" rmdir /s /q "build" >> "%LOG_FILE%" 2>&1
if exist "dist\Jarvis" rmdir /s /q "dist\Jarvis" >> "%LOG_FILE%" 2>&1

echo Iniciando PyInstaller... >> "%LOG_FILE%"
%PY_CMD% -m PyInstaller --onedir --name Jarvis !ICON_ARG! --hidden-import chromadb.telemetry.product.posthog --collect-all chromadb --collect-all numpy --collect-all pygame main.py >> "%LOG_FILE%" 2>&1

if errorlevel 1 goto BUILD_ERROR

echo.
echo [OK] Executavel gerado com sucesso em: dist\Jarvis
echo Log completo: "%LOG_FILE%"
pause
exit /b 0

:TRY_PYTHON
if defined PY_CMD exit /b 0
set "CANDIDATE=%~1"
echo Testando Python: %CANDIDATE% >> "%LOG_FILE%"
%CANDIDATE% -c "import sys; print(sys.executable)" >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
	echo Python indisponivel: %CANDIDATE% >> "%LOG_FILE%"
	exit /b 0
)
%CANDIDATE% -m pip --version >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
	echo pip nao encontrado em %CANDIDATE%. Tentando ensurepip... >> "%LOG_FILE%"
	%CANDIDATE% -m ensurepip --upgrade >> "%LOG_FILE%" 2>&1
	%CANDIDATE% -m pip --version >> "%LOG_FILE%" 2>&1
)
if errorlevel 1 (
	echo pip indisponivel em %CANDIDATE%. >> "%LOG_FILE%"
	exit /b 0
)
set "PY_CMD=%CANDIDATE%"
exit /b 0

:BUILD_ERROR
echo.
echo [ERRO] A geracao falhou.
echo Veja o arquivo de log: "%LOG_FILE%"
echo.
type "%LOG_FILE%"
pause
exit /b 1
