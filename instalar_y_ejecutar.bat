@echo off
chcp 65001 > nul
title Backup JAS Store

echo ==================================================
echo   Backup JAS Store
echo ==================================================
echo.

:: ── 1. Buscar Python ──────────────────────────────────────────────────────────

set PYTHON_CMD=

:: Intentar con el lanzador de Python (py.exe — instalacion tipica Windows)
py --version > nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=py
    goto verificar_config
)

:: Intentar con python directamente
python --version > nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_CMD=python
    goto verificar_config
)

:: Intentar en rutas comunes de instalacion
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Program Files\Python313\python.exe"
    "C:\Program Files\Python312\python.exe"
) do (
    if exist %%P (
        set PYTHON_CMD=%%P
        goto verificar_config
    )
)

:: ── 2. Python no encontrado — instalar ───────────────────────────────────────

echo Python no esta instalado. Instalando automaticamente...
echo (esto puede tardar 1-2 minutos la primera vez)
echo.

:: Intentar con winget (disponible en Windows 10/11 actualizados)
winget install -e --id Python.Python.3.12 --silent --accept-source-agreements --accept-package-agreements > nul 2>&1
if %errorlevel% == 0 (
    echo Python instalado con winget.
    set PYTHON_CMD=py
    :: Actualizar PATH en esta sesion
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python312\;%LOCALAPPDATA%\Programs\Python\Python312\Scripts\;%PATH%"
    goto verificar_config
)

:: Si winget fallo, descargar instalador directamente
echo Descargando instalador de Python 3.12...
curl -# -L -o "%TEMP%\python_setup.exe" "https://www.python.org/ftp/python/3.12.9/python-3.12.9-amd64.exe"
if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo descargar Python.
    echo Verifica tu conexion a internet y vuelve a intentarlo.
    echo.
    pause
    exit /b 1
)

echo Instalando Python 3.12...
"%TEMP%\python_setup.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_doc=0
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Fallo la instalacion de Python.
    echo Intenta correr este archivo como Administrador (clic derecho -> Ejecutar como administrador).
    echo.
    pause
    exit /b 1
)

set "PATH=%LOCALAPPDATA%\Programs\Python\Python312\;%LOCALAPPDATA%\Programs\Python\Python312\Scripts\;%PATH%"
set PYTHON_CMD=python
echo Python instalado correctamente.

:: ── 3. Verificar que existe .env.local o backup_config.txt ───────────────────

:verificar_config
echo.

if not exist "%~dp0.env.local" (
    if not exist "%~dp0backup_config.txt" (
        echo No se encontro el archivo de configuracion.
        echo.
        echo Crea un archivo llamado  backup_config.txt  en la misma carpeta
        echo que este archivo, con el siguiente contenido:
        echo.
        echo   VITE_SUPABASE_URL=https://ypbshbnixkpynmpefqjd.supabase.co
        echo   VITE_SUPABASE_SERVICE_KEY=tu_clave_aqui
        echo.
        echo Pidele la clave a Sebastian.
        echo.
        pause
        exit /b 1
    )
)

:: ── 4. Ejecutar el backup ─────────────────────────────────────────────────────

%PYTHON_CMD% "%~dp0backup_local.py"
