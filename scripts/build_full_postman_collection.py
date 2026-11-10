import json
import re
import os
import shutil
import argparse
from pathlib import Path

TUNNEL_URL = "https://lsw-eq1-proyecto.onrender.com"
HOST_PARTS = ["lsw-eq1-proyecto", "onrender", "com"]

def clean_url_string(u):
    if not u:
        return u
    # Reemplazar cualquier variante previa de localhost o cloudflare por la URL viva de Render
    u = re.sub(r"https?://[a-zA-Z0-9\-\.]+\.trycloudflare\.com", TUNNEL_URL, u)
    u = re.sub(r"http://localhost:\d+", TUNNEL_URL, u)
    u = u.replace("{{baseUrl}}", f"{TUNNEL_URL}/api/v1")
    u = u.replace("{{symbol}}", "NVDA")
    u = u.replace("{{symbolAlpaca}}", "AAPL")
    u = u.replace("{{expiration}}", "2026-12-18")
    u = u.replace("{{strategyIdMongo}}", "670d7e684fb65a25032b43a1")
    u = u.replace("{{strategyIdSupabase}}", "c0000000-0000-0000-0000-000000000001")
    u = u.replace("{{webullOrderId}}", "b058af6bc909445781016e62e3a98c06")
    u = u.replace("{{alpacaOrderId}}", "970921fb-5536-4d0f-b44c-0c1efebf8691")
    return u

def make_url_obj(raw_url):
    u = clean_url_string(raw_url)

    query_parts = []
    base_and_query = u.split("?", 1)
    base_part = base_and_query[0]
    
    if len(base_and_query) > 1:
        qs = base_and_query[1].split("&")
        for q in qs:
            if "=" in q:
                k, v = q.split("=", 1)
                query_parts.append({"key": k, "value": v})
            else:
                query_parts.append({"key": q, "value": ""})

    path_str = base_part.replace(f"{TUNNEL_URL}/", "")
    path_segments = [p for p in path_str.split("/") if p]

    url_obj = {
        "raw": u,
        "protocol": "https",
        "host": HOST_PARTS,
        "path": path_segments
    }
    if query_parts:
        url_obj["query"] = query_parts
    return url_obj

def sanitize_item_recursive(it):
    if isinstance(it, dict):
        if "request" in it and isinstance(it["request"], dict):
            req = it["request"]
            if "url" in req:
                u = req["url"]
                if isinstance(u, str):
                    req["url"] = make_url_obj(u)
                elif isinstance(u, dict):
                    raw_str = u.get("raw", "")
                    cleaned_raw = clean_url_string(raw_str)
                    u["raw"] = cleaned_raw
                    u["protocol"] = "https"
                    u["host"] = HOST_PARTS
                    base_only = cleaned_raw.split("?")[0].replace(f"{TUNNEL_URL}/", "")
                    u["path"] = [p for p in base_only.split("/") if p]
        if "item" in it and isinstance(it["item"], list):
            for sub in it["item"]:
                sanitize_item_recursive(sub)
    elif isinstance(it, list):
        for sub in it:
            sanitize_item_recursive(sub)

def parse_http_file(http_path):
    with open(http_path, "r", encoding="utf-8") as f:
        content = f.read()

    secs = re.split(r"(?m)^### (SECCI\S+ [^\n]+)", content)
    parsed_sections = []
    
    for i in range(1, len(secs), 2):
        sec_name = secs[i].strip()
        sec_body = secs[i+1]
        
        req_blocks = re.split(r"(?m)^### (\d+\.\d+ [^\n]+)", sec_body)
        requests_in_sec = []
        for j in range(1, len(req_blocks), 2):
            req_title = req_blocks[j].strip()
            req_text = req_blocks[j+1].strip()
            
            lines = req_text.splitlines()
            method = None
            url_raw = None
            headers = []
            body_lines = []
            is_body = False
            
            for line in lines:
                sline = line.strip()
                if not sline:
                    if method and not is_body:
                        is_body = True
                    elif is_body:
                        body_lines.append(line)
                    continue
                
                if sline.startswith("#"):
                    continue
                
                if not method and re.match(r"^(GET|POST|PUT|DELETE|PATCH)\s+", sline):
                    m_match = re.match(r"^(GET|POST|PUT|DELETE|PATCH)\s+(.+)", sline)
                    method = m_match.group(1)
                    url_raw = m_match.group(2).strip()
                    continue
                
                if not is_body and ":" in sline:
                    hk, hv = sline.split(":", 1)
                    headers.append({"key": hk.strip(), "value": hv.strip()})
                elif is_body:
                    body_lines.append(line)
            
            if method and url_raw:
                req_obj = {
                    "name": req_title,
                    "request": {
                        "method": method,
                        "header": headers,
                        "url": make_url_obj(url_raw)
                    },
                    "response": []
                }
                if body_lines:
                    body_str = "\n".join(body_lines).strip()
                    if body_str:
                        req_obj["request"]["body"] = {
                            "mode": "raw",
                            "raw": body_str,
                            "options": {"raw": {"language": "json"}}
                        }
                requests_in_sec.append(req_obj)
        
        if requests_in_sec:
            parsed_sections.append({
                "name": sec_name,
                "item": requests_in_sec
            })
            
    return parsed_sections

def get_guided_tutorials():
    # Cargar los 3 tutoriales paso a paso calibrados
    base_file = r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\LSW_Cloudflare_Postman_Collection.json"
    if not os.path.exists(base_file):
        base_file = r"c:\GitHub\FIC-generator\LSW_Cloudflare_Postman_Collection.json"
        
    with open(base_file, "r", encoding="utf-8") as f:
        existing = json.load(f)
    
    tutorials = []
    u1 = None
    
    def search_items(item_list):
        nonlocal u1
        for top in item_list:
            if "U1" in top.get("name", "") and not u1:
                u1 = top
            if top.get("name") in ["TutorialWebull", "TutorialAlpaca", "TutorialInteractiveBrokers"]:
                if top not in tutorials:
                    tutorials.append(top)
            if "item" in top:
                search_items(top["item"])

    search_items(existing.get("item", []))
    
    # Sanitizar recursivamente tutoriales y U1 para que apunten a Render
    for t in tutorials:
        sanitize_item_recursive(t)
    if u1:
        sanitize_item_recursive(u1)
        
    return tutorials, u1

def agregarConsultasPortafolio(coleccion):
    variables = coleccion.setdefault("variable", [])
    clavesExistentes = {variable["key"] for variable in variables}
    for clave, valor in [
        ("tokenPortafolio", ""),
        ("brokerPortafolio", "WEBULL"),
        ("baseDatosPortafolio", "mongodb"),
    ]:
        if clave not in clavesExistentes:
            variables.append({"key": clave, "value": valor, "type": "string"})

    ejemplos = []
    for nombre, ruta in [
        ("Cuenta confirmada del broker", "broker/account"),
        ("Posiciones abiertas confirmadas", "broker/positions"),
        ("Coberturas guardadas", "hedging"),
    ]:
        esConsultaBroker = ruta.startswith("broker/")
        url = {
            "raw": "{{baseUrl}}/" + ruta,
            "host": ["{{baseUrl}}"],
            "path": ruta.split("/"),
        }
        if esConsultaBroker:
            url["raw"] += "?strict=true"
            url["query"] = [{"key": "strict", "value": "true"}]
        encabezado = (
            {"key": "x-broker-selection", "value": "{{brokerPortafolio}}"}
            if esConsultaBroker else
            {"key": "x-database-selection", "value": "{{baseDatosPortafolio}}"}
        )
        ejemplos.append({"name": nombre, "request": {"method": "GET", "header": [encabezado], "url": url}})

    nombreCarpeta = "Portafolio (solo lectura)"
    carpeta = {
        "name": nombreCarpeta,
        "description": (
            "Usa un token de /auth/login en tokenPortafolio y selecciona el broker y la base. "
            "Las lecturas estrictas devuelven 503 cuando el broker no está disponible."
        ),
        "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{tokenPortafolio}}", "type": "string"}]},
        "item": ejemplos,
    }
    carpetas = coleccion["item"]
    for indice, existente in enumerate(carpetas):
        if existente.get("name") == nombreCarpeta:
            carpetas[indice] = carpeta
            return
    carpetas.append(carpeta)


def sincronizarSoloPortafolio():
    raiz = Path(__file__).resolve().parent.parent
    for nombre in ["LSW_Cloudflare_Postman_Collection.json", "LSW_Render_Postman_Collection.json"]:
        ruta = raiz / nombre
        coleccion = json.loads(ruta.read_text(encoding="utf-8"))
        agregarConsultasPortafolio(coleccion)
        ruta.write_text(json.dumps(coleccion, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Portafolio sincronizado en {nombre}")


def build_complete_collection():
    tutorials, u1 = get_guided_tutorials()
    http_path = r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\request\test_api.http"
    tech_sections = parse_http_file(http_path)
    
    items = []
    
    # 1. Tutoriales Paso a Paso
    items.append({
        "name": "1. Flujos Guiados Paso a Paso (Webull, Alpaca, IBKR)",
        "description": "Tutoriales completos de 11 pasos calibrados para ejecutar coberturas Collar completas en cada broker alojados en Render Cloud.",
        "item": tutorials
    })
    
    # 2. Secciones Técnicas (0 a 7)
    for sec in tech_sections:
        items.append({
            "name": sec["name"],
            "item": sec["item"]
        })
        
    # 3. U1 Servicios Base
    if u1:
        items.append(u1)
        
    # Sanitizar todos los items al 100%
    for it in items:
        sanitize_item_recursive(it)
        
    collection = {
        "info": {
            "_postman_id": "29bd2619-9d1e-4c01-b368-90f726381b41",
            "name": "LSW - Coberturas Financieras y Motor FIC (Render Cloud 24/7 - Equipo 1)",
            "description": "Colección OFICIAL y calibrada al 100% para Render Cloud (https://lsw-eq1-proyecto.onrender.com). Permite verificar la totalidad de los 104 endpoints REST: Autenticación JWT, Activos Subyacentes, Opciones Cuantitativas F0, Spreads Collar y Coberturas en los 3 Brokers (Webull, Alpaca e Interactive Brokers en DigitalOcean VPS).",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "variable": [
            {
                "key": "baseUrl",
                "value": "https://lsw-eq1-proyecto.onrender.com/api/v1",
                "type": "string",
                "description": "URL base pública alojada 24/7 en Render Cloud"
            },
            {
                "key": "symbol",
                "value": "NVDA",
                "type": "string"
            },
            {
                "key": "symbolAlpaca",
                "value": "AAPL",
                "type": "string"
            },
            {
                "key": "expiration",
                "value": "2026-12-18",
                "type": "string"
            }
        ],
        "item": items
    }
    
    agregarConsultasPortafolio(collection)

    out_paths = [
        r"c:\GitHub\FIC-generator\LSW_Cloudflare_Postman_Collection.json",
        r"c:\GitHub\FIC-generator\LSW_Render_Postman_Collection.json",
        r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\LSW_Cloudflare_Postman_Collection.json",
        r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\LSW_Render_Postman_Collection.json",
        r"c:\GitHub\FIC-generator\U2Act2\LSW_Cloudflare_Postman_Collection.json",
        r"c:\GitHub\FIC-generator\U2Act2\LSW_Render_Postman_Collection.json",
        r"C:\Users\ealta\.gemini\antigravity\brain\dc48f4da-e1e3-43d9-81ea-99f87e476809\LSW_Cloudflare_Postman_Collection.json",
        r"C:\Users\ealta\.gemini\antigravity\brain\dc48f4da-e1e3-43d9-81ea-99f87e476809\LSW_Render_Postman_Collection.json"
    ]
    
    for op in out_paths:
        with open(op, "w", encoding="utf-8") as f:
            json.dump(collection, f, indent=2, ensure_ascii=False)
        print(f"Colección guardada con éxito en: {op}")

    # Copia en el Escritorio para facilidad de importación en Postman
    desktop_dir = r"C:\Users\ealta\OneDrive\Escritorio"
    if os.path.exists(desktop_dir):
        desktop_dest = os.path.join(desktop_dir, "LSW_Render_Postman_Collection.json")
        shutil.copyfile(out_paths[0], desktop_dest)
        print(f"Copia creada directamente en Escritorio: {desktop_dest}")

    total_reqs = 0
    def count_reqs(it_list):
        nonlocal total_reqs
        for it in it_list:
            if "item" in it:
                count_reqs(it["item"])
            elif "request" in it:
                total_reqs += 1
    count_reqs(items)
    print(f"\n>>> PROCESO FINALIZADO: {len(items)} carpetas principales con un total de {total_reqs} peticiones REST calibradas.")

def sync_black_scholes_only():
    """Sincroniza esta petición sin regenerar otros flujos ni copias externas."""
    repo_root = Path(__file__).resolve().parent.parent

    def requests_in(items):
        for item in items:
            if "request" in item:
                yield item
            yield from requests_in(item.get("item", []))

    def is_black_scholes(item):
        request = item.get("request", {})
        url = request.get("url", "")
        raw = url.get("raw", "") if isinstance(url, dict) else url
        return request.get("method") == "POST" and raw.split("?")[0].endswith("/quant/black-scholes")

    sections = parse_http_file(repo_root / "request" / "test_api.http")
    sources = [item for item in requests_in(sections) if is_black_scholes(item)]
    if len(sources) != 1:
        raise ValueError("Se esperaba una petición Black-Scholes en request/test_api.http")

    description = (
        "Validación SDD: spotPrice, strikePrice y timeToExpirationYears son obligatorios y > 0; "
        "volatility debe ser > 0 y riskFreeRate finita de cualquier signo. Se admiten números "
        "o cadenas numéricas no vacías y CALL/PUT sin distinguir mayúsculas. "
        "Valores predeterminados: volatility=0.2, riskFreeRate=0.045 y optionType=PUT. "
        "Los campos inválidos y los resultados no finitos devuelven 400 con un mensaje descriptivo."
    )
    assertions = [
        'pm.test("Black-Scholes: respuesta válida y finita", function () {',
        '    pm.response.to.have.status(200);',
        '    const body = pm.response.json();',
        '    pm.expect(body.optionType).to.be.oneOf(["CALL", "PUT"]);',
        '    const values = [body.theoreticalPrice, body.greeks.delta, body.greeks.gamma,',
        '        body.greeks.theta, body.greeks.vega, body.greeks.rho];',
        '    values.forEach(value => pm.expect(Number.isFinite(value)).to.eql(true));',
        '});',
    ]

    for name in ["LSW_Cloudflare_Postman_Collection.json", "LSW_Render_Postman_Collection.json"]:
        path = repo_root / name
        collection = json.loads(path.read_text(encoding="utf-8"))
        matches = [item for item in requests_in(collection.get("item", [])) if is_black_scholes(item)]
        if len(matches) != 1:
            raise ValueError(f"Se esperaba una petición Black-Scholes en {name}")
        item = matches[0]
        item["request"]["body"] = sources[0]["request"]["body"]
        item["request"]["description"] = description
        events = item.setdefault("event", [])
        test_event = next((event for event in events if event.get("listen") == "test"), None)
        if test_event is None:
            test_event = {"listen": "test", "script": {"type": "text/javascript", "exec": []}}
            events.append(test_event)
        lines = test_event["script"]["exec"]
        if assertions[0] not in lines:
            lines.extend(assertions)
        path.write_text(json.dumps(collection, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Black-Scholes sincronizado en {path.name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generar o sincronizar la colección Postman")
    opciones = parser.add_mutually_exclusive_group()
    opciones.add_argument("--black-scholes-only", action="store_true", help="Actualizar solo Black-Scholes en las colecciones del repositorio")
    opciones.add_argument("--portafolio-only", action="store_true", help="Actualizar solo Portafolio en las colecciones del repositorio")
    args = parser.parse_args()
    if args.black_scholes_only:
        sync_black_scholes_only()
    elif args.portafolio_only:
        sincronizarSoloPortafolio()
    else:
        build_complete_collection()
