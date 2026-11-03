@echo off
setlocal
chcp 65001 >nul
title Pubblicazione metiMaia
pushd "%~dp0"
if errorlevel 1 goto folder_error
if not exist "site\index.html" goto incomplete
if not exist "cloudflare-publish.mjs" goto incomplete
if not exist "site-sha256.json" goto incomplete
where node >nul 2>nul
if errorlevel 1 goto need_node
echo.
echo Questa procedura aggiorna il Worker metimaia con il sito completo v14.2.
echo L'accesso avviene nel browser ufficiale Cloudflare.
echo.
node "cloudflare-publish.mjs"
set "MAIA_PUBLISH_RESULT=%errorlevel%"
echo.
if not "%MAIA_PUBLISH_RESULT%"=="0" echo Procedura interrotta. Conserva il messaggio qui sopra.
pause
popd
exit /b %MAIA_PUBLISH_RESULT%

:need_node
echo.
echo Installa Node.js LTS da https://nodejs.org/it/download, mantenendo npm.
echo Dopo l'installazione riapri questo file.
echo.
pause
popd
exit /b 1

:incomplete
echo.
echo Il pacchetto non e' completo. Estrai TUTTO lo ZIP prima di aprire questo file.
echo Apri PUBBLICA-MAIA.cmd dalla cartella estratta sul computer.
echo.
pause
popd
exit /b 1

:folder_error
echo Impossibile aprire la cartella. Estrai lo ZIP sul Desktop e riprova.
pause
exit /b 1
