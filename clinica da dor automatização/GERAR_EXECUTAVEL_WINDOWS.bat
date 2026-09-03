@echo off
cd /d "%~dp0"
echo Gerando as duas versoes do Windows:
echo   1. Instalador (Setup.exe)
echo   2. Executavel portatil (.exe)
echo.
call npm run dist:win
if errorlevel 1 goto erro
echo.
echo Pronto. Os arquivos foram gerados na pasta release.
echo.
echo Voce encontrara:
echo   - um Setup.exe para instalar no Windows e criar atalhos;
echo   - um .exe portatil para abrir diretamente sem instalar.
echo.
pause
exit /b 0
:erro
echo.
echo Nao foi possivel concluir. Verifique as mensagens acima.
pause
exit /b 1
