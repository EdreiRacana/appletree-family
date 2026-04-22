@echo off
TITLE AppleTree Family - Dev Server
echo ==========================================
echo    Iniciando AppleTree Family...
echo ==========================================
echo.

:: Navegar a la carpeta de la aplicación web
cd apps\web

:: Abrir el navegador en localhost:3000
echo Abriendo el navegador...
start http://localhost:3000

:: Ejecutar el servidor de desarrollo
echo Ejecutando npm run dev...
npm run dev

pause
