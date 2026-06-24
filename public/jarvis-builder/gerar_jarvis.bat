@echo off
setlocal
cd /d "%~dp0"
title Jarvis Builder

echo Abrindo a interface do Jarvis Builder...
echo Se preferir sem tela preta, execute o arquivo "Gerar Jarvis.vbs".

if exist "%~dp0Gerar Jarvis.vbs" (
	wscript.exe "%~dp0Gerar Jarvis.vbs"
	exit /b 0
)

echo Nao encontrei o lancador grafico. Tentando abrir com Python...
py -3 "%~dp0builder_gui.pyw"
if not %errorlevel%==0 python "%~dp0builder_gui.pyw"
