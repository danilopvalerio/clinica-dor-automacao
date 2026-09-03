@echo off
cd /d "%~dp0"
call npm run dist:win
if errorlevel 1 goto erro
echo.
echo Build concluido. Veja a pasta release.
pause
exit /b 0
:erro
echo.
echo O build falhou. Verifique as mensagens acima.
pause
exit /b 1
