"""
Backup local de Supabase — JAS Store
Ejecuta con doble clic o: python backup_local.py
Guarda los CSVs en: backups/YYYY-MM-DD/

Las credenciales se leen automáticamente desde .env.local
"""

import urllib.request
import urllib.error
import os
import subprocess
from datetime import datetime

TABLAS = [
    "clients",
    "orders",
    "payments",
    "payment_proofs",
    "supplier_purchases",
    "suppliers",
    "expenses",
]


def leer_env(ruta: str) -> dict:
    """Lee un archivo .env y devuelve un dict con las variables."""
    variables = {}
    try:
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                linea = linea.strip()
                if not linea or linea.startswith("#") or "=" not in linea:
                    continue
                clave, _, valor = linea.partition("=")
                variables[clave.strip()] = valor.strip()
    except FileNotFoundError:
        pass
    return variables


def descargar_tabla(tabla: str, carpeta: str, url: str, key: str) -> int:
    endpoint = f"{url}/rest/v1/{tabla}?select=*&limit=50000"
    req = urllib.request.Request(endpoint, headers={
        "apikey":        key,
        "Authorization": f"Bearer {key}",
        "Accept":        "text/csv",
    })
    ruta = os.path.join(carpeta, f"{tabla}.csv")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            contenido = resp.read()
        with open(ruta, "wb") as f:
            f.write(contenido)
        filas = contenido.count(b"\n") - 1
        return max(filas, 0)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.reason}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Sin conexion: {e.reason}")


def main():
    print("=" * 50)
    print("  Backup JAS Store — Supabase")
    print("=" * 50)

    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Leer credenciales: primero backup_config.txt, luego .env.local
    env = leer_env(os.path.join(base_dir, "backup_config.txt"))
    if not env:
        env = leer_env(os.path.join(base_dir, ".env.local"))

    supabase_url = env.get("VITE_SUPABASE_URL", "")
    supabase_key = env.get("VITE_SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not supabase_key:
        print("\nERROR: No se encontraron las credenciales.")
        print("Crea un archivo backup_config.txt con:")
        print("  VITE_SUPABASE_URL=https://...")
        print("  VITE_SUPABASE_SERVICE_KEY=tu_clave")
        input("\nPresiona Enter para cerrar...")
        return

    fecha   = datetime.now().strftime("%Y-%m-%d")
    carpeta = os.path.join(base_dir, "backups", fecha)
    os.makedirs(carpeta, exist_ok=True)

    print(f"\nCarpeta: backups/{fecha}/\n")

    exitos  = 0
    errores = 0

    for tabla in TABLAS:
        print(f"  Descargando {tabla}...", end=" ", flush=True)
        try:
            filas = descargar_tabla(tabla, carpeta, supabase_url, supabase_key)
            print(f"OK - {filas} filas")
            exitos += 1
        except RuntimeError as e:
            print(f"ERROR: {e}")
            errores += 1

    print(f"\n{'=' * 50}")
    print(f"  {exitos} tablas OK  |  {errores} errores")
    print(f"{'=' * 50}\n")

    if exitos > 0:
        print(f"Backup guardado en:\n  {carpeta}\n")
        subprocess.Popen(["explorer", carpeta])

    input("Presiona Enter para cerrar...")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelado.")
    except Exception as e:
        print(f"\nError inesperado: {e}")
        input("Presiona Enter para cerrar...")
