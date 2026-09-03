@echo off
cd /d "%~dp0"
echo Instalando dependencias...
call npm install
if errorlevel 1 goto erro
echo.
echo Iniciando aplicativo em modo de desenvolvimento...
call npm run dev
exit /b 0
:erro
echo.
echo Falha ao instalar as dependencias. Verifique sua conexao com a internet e se Node.js esta instalado.
pause
exit /b 1
