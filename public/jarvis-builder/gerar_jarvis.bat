@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "LOG_FILE=%~dp0build_jarvis.log"
set "ICON_PATH=C:\Users\FOTOGRAFIA\AppData\Roaming\JetBrains\PyCharm2025.1\scratches\jarvis.ico"
set "PY_CMD="

echo ===== Jarvis Builder ===== > "%LOG_FILE%"
echo Data/Hora: %date% %time% >> "%LOG_FILE%"
echo Pasta: %cd% >> "%LOG_FILE%"

where py >nul 2>&1
if %errorlevel%==0 (
	set "PY_CMD=py -3"
) else (
	where python >nul 2>&1
	if %errorlevel%==0 (
		set "PY_CMD=python"
	)
)

if "%PY_CMD%"=="" (
	echo ERRO: Python nao encontrado no PATH. >> "%LOG_FILE%"
	echo.
	echo [ERRO] Python nao encontrado no computador.
	echo Instale o Python 3 e marque a opcao "Add python.exe to PATH".
	echo Detalhes em: "%LOG_FILE%"
	pause
	exit /b 1
)

echo Usando comando Python: %PY_CMD% >> "%LOG_FILE%"

%PY_CMD% -m pip show pyinstaller >nul 2>&1
if not %errorlevel%==0 (
	echo PyInstaller nao encontrado. Instalando... >> "%LOG_FILE%"
	%PY_CMD% -m pip install --upgrade pip >> "%LOG_FILE%" 2>&1
	%PY_CMD% -m pip install pyinstaller >> "%LOG_FILE%" 2>&1
)

set "ICON_ARG="
if exist "%ICON_PATH%" (
	set "ICON_ARG=--icon=%ICON_PATH%"
	echo Icone encontrado em %ICON_PATH% >> "%LOG_FILE%"
) else (
	echo Icone nao encontrado em %ICON_PATH%. Gerando sem icone. >> "%LOG_FILE%"
)

echo Iniciando PyInstaller... >> "%LOG_FILE%"
%PY_CMD% -m PyInstaller --onedir --name Jarvis !ICON_ARG! --hidden-import chromadb.telemetry.product.posthog --collect-all chromadb --collect-all numpy main.py >> "%LOG_FILE%" 2>&1

if not %errorlevel%==0 (
	echo.
	echo [ERRO] A geracao falhou.
	echo Veja o arquivo de log: "%LOG_FILE%"
	echo.
	type "%LOG_FILE%"
	pause
	exit /b 1
)

echo.
echo [OK] Executavel gerado com sucesso em: dist\Jarvis
echo Log completo: "%LOG_FILE%"
pause
