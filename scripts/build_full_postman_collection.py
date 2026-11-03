import json
import re

TUNNEL_URL = "https://consist-overall-leaders-supplement.trycloudflare.com"
HOST_PARTS = ["consist-overall-leaders-supplement", "trycloudflare", "com"]

def make_url_obj(raw_url):
    u = raw_url.replace("{{baseUrl}}", f"{TUNNEL_URL}/api/v1")
    u = u.replace("http://localhost:3050/api/v1", f"{TUNNEL_URL}/api/v1")
    u = u.replace("http://localhost:3020/api/v1", f"{TUNNEL_URL}/api/v1")
    u = u.replace("{{symbol}}", "NVDA")
    u = u.replace("{{symbolAlpaca}}", "AAPL")
    u = u.replace("{{expiration}}", "2026-10-16")
    u = u.replace("{{strategyIdMongo}}", "670d7e684fb65a25032b43a1")
    u = u.replace("{{strategyIdSupabase}}", "c0000000-0000-0000-0000-000000000001")
    u = u.replace("{{webullOrderId}}", "b058af6bc909445781016e62e3a98c06")
    u = u.replace("{{alpacaOrderId}}", "970921fb-5536-4d0f-b44c-0c1efebf8691")

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
    # Cargar los 3 tutoriales paso a paso calibrados de generate_calibrated_collection
    with open(r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\LSW_Cloudflare_Postman_Collection.json", "r", encoding="utf-8") as f:
        existing = json.load(f)
    
    tutorials = []
    u1 = None
    for top in existing.get("item", []):
        if "U1" in top.get("name", ""):
            u1 = top
        elif top.get("name") == "PROYECTO":
            for sub in top.get("item", []):
                if sub.get("name") in ["TutorialWebull", "TutorialAlpaca", "TutorialInteractiveBrokers"]:
                    tutorials.append(sub)
    return tutorials, u1

def build_complete_collection():
    tutorials, u1 = get_guided_tutorials()
    http_path = r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\request\test_api.http"
    tech_sections = parse_http_file(http_path)
    
    items = []
    
    # 1. Tutoriales Paso a Paso
    items.append({
        "name": "1. Flujos Guiados Paso a Paso (Webull, Alpaca, IBKR)",
        "description": "Tutoriales completos de 11 pasos calibrados para ejecutar coberturas Collar completas en cada broker.",
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
        
    collection = {
        "info": {
            "_postman_id": "29bd2619-9d1e-4c01-b368-90f726381b41",
            "name": "LSW - Coberturas Financieras y Motor FIC (Equipo 1 - Colección Completa)",
            "description": "Colección EXHAUSTIVA y calibrada con el 100% de los endpoints REST del backend (Equipo 1). Incluye flujos paso a paso para Webull, Alpaca e Interactive Brokers, Autenticación JWT, Activos Subyacentes (CRUD Políglota), Motor Cuantitativo F0 (Black-Scholes y Newton-Raphson), Coberturas Hedging, Operaciones con Subdocumentos y Multi-Broker.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "variable": [
            {
                "key": "baseUrl",
                "value": "https://consist-overall-leaders-supplement.trycloudflare.com/api/v1",
                "type": "string",
                "description": "URL base pública a través de Cloudflare Tunnel"
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
                "value": "2026-10-16",
                "type": "string"
            }
        ],
        "item": items
    }
    
    out_paths = [
        r"c:\GitHub\FIC-generator\LSW_Cloudflare_Postman_Collection.json",
        r"c:\GitHub\FIC-generator\LSW-EQ1-PROYECTO\LSW_Cloudflare_Postman_Collection.json",
        r"c:\GitHub\FIC-generator\U2Act2\LSW_Cloudflare_Postman_Collection.json",
        r"C:\Users\ealta\.gemini\antigravity\brain\dc48f4da-e1e3-43d9-81ea-99f87e476809\LSW_Cloudflare_Postman_Collection.json"
    ]
    
    for op in out_paths:
        with open(op, "w", encoding="utf-8") as f:
            json.dump(collection, f, indent=2, ensure_ascii=False)
        print(f"Colección guardada con éxito en: {op}")

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

if __name__ == "__main__":
    build_complete_collection()

