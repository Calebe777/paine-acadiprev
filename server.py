import os
import json
import socket
import sys
import threading
import time
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler
from datetime import datetime

PORT = int(os.environ.get("PORT", 8000))

class MyHTTPRequestHandler(SimpleHTTPRequestHandler):
    """
    Handler HTTP customizado que suporta GET e POST, fornecendo
    rotas de API para faturamento (Webhook Hotmart), checklists e configurações.
    """
    def do_GET(self):
        if self.path == '/api/data':
            try:
                db_path = os.path.join(os.getcwd(), 'data.json')
                
                # Caso o arquivo data.json não exista por algum motivo, inicializa ele
                if not os.path.exists(db_path):
                    initial_data = {
                        "revenue": 5318725.11,
                        "waiting_list": 172,
                        "checklist": {
                            "bebidas": False, "almoco": False, "jantar": False, "vans": False,
                            "mesas": False, "copos": False, "painel": False, "frutas": False,
                            "folders": False, "trofeus": False, "plaquinhas": False, "tacas": False
                        },
                        "event_dates": {
                            "faprev_gold": "2026-09-03",
                            "congresso_5": "2027-04-09",
                            "alianca_prev": "2026-08-24"
                        },
                        "recent_sales": []
                    }
                    with open(db_path, 'w', encoding='utf-8') as f:
                        json.dump(initial_data, f, indent=4, ensure_ascii=False)
                
                with open(db_path, 'r', encoding='utf-8') as f:
                    data = f.read()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            # Comportamento padrão de servidor de arquivos estáticos
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        db_path = os.path.join(os.getcwd(), 'data.json')
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        
        # 1. Rota do Webhook da Hotmart (Venda Aprovada)
        if self.path == '/api/webhook':
            try:
                payload = json.loads(post_data.decode('utf-8'))
                
                # Extração de detalhes (suportando v2 e v1 da Hotmart)
                value = 0.0
                buyer_name = "Cliente Hotmart"
                product_name = "Produto Hotmart"
                
                if "data" in payload:
                    data_obj = payload["data"]
                    if "purchase" in data_obj:
                        purchase = data_obj["purchase"]
                        if "price" in purchase:
                            value = float(purchase["price"].get("value", 0.0))
                        elif "original_value_cents" in purchase:
                            value = float(purchase["original_value_cents"]) / 100.0
                    if "buyer" in data_obj:
                        buyer_name = data_obj["buyer"].get("name", "Cliente Hotmart")
                    if "product" in data_obj:
                        product_name = data_obj["product"].get("name", "Produto Hotmart")
                else:
                    value = float(payload.get("price", payload.get("value", 0.0)))
                    buyer_name = payload.get("name", payload.get("buyer_name", "Cliente Hotmart"))
                    product_name = payload.get("prod", payload.get("product_name", "Produto Hotmart"))
                
                # Carrega o banco de dados
                with open(db_path, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                
                # Validação de segurança por token Hottok (opcional)
                hottok_header = self.headers.get('X-Hotmart-Hottok')
                expected_hottok = os.environ.get("HOTMART_HOTTOK") or db.get("hotmart_hottok")
                
                if expected_hottok:
                    if not hottok_header or hottok_header != expected_hottok:
                        print(f"[HOTMART WEBHOOK] [NEGADO] Token Hottok inválido ou ausente! Recebido: {hottok_header}")
                        self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized: Invalid Hottok"}).encode('utf-8'))
                        return
                
                # Atualiza os dados
                db["revenue"] = db.get("revenue", 0.0) + value
                
                new_sale = {
                    "buyer": buyer_name,
                    "value": value,
                    "product": product_name,
                    "time": datetime.now().isoformat()
                }
                recent = db.get("recent_sales", [])
                recent.insert(0, new_sale)
                db["recent_sales"] = recent[:5]  # Mantém as últimas 5 vendas
                
                with open(db_path, 'w', encoding='utf-8') as f:
                    json.dump(db, f, indent=4, ensure_ascii=False)
                
                print(f"[HOTMART WEBHOOK] Venda Processada! Comprador: {buyer_name} | Valor: R$ {value:.2f} | Produto: {product_name}")
                self.wfile.write(json.dumps({"status": "success", "message": "Sale approved successfully"}).encode('utf-8'))
                
            except Exception as e:
                print(f"[!] Erro ao processar webhook da Hotmart: {e}")
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                
        # 2. Rota para salvar alterações no Checklist Elite
        elif self.path == '/api/checklist':
            try:
                payload = json.loads(post_data.decode('utf-8'))
                item = payload.get("item")
                status = payload.get("status")
                
                with open(db_path, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                
                if "checklist" not in db:
                    db["checklist"] = {}
                
                db["checklist"][item] = status
                
                with open(db_path, 'w', encoding='utf-8') as f:
                    json.dump(db, f, indent=4, ensure_ascii=False)
                
                print(f"[API CHECKLIST] Item '{item}' atualizado para: {status}")
                self.wfile.write(json.dumps({"status": "success", "checklist": db["checklist"]}).encode('utf-8'))
                
            except Exception as e:
                print(f"[!] Erro ao atualizar checklist: {e}")
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                
        # 3. Rota para editar Configurações (Ajuste manual de faturamento e datas)
        elif self.path == '/api/config':
            try:
                payload = json.loads(post_data.decode('utf-8'))
                
                with open(db_path, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                
                if "revenue" in payload:
                    db["revenue"] = float(payload["revenue"])
                if "waiting_list" in payload:
                    db["waiting_list"] = int(payload["waiting_list"])
                if "hotmart_hottok" in payload:
                    db["hotmart_hottok"] = str(payload["hotmart_hottok"])
                if "event_dates" in payload:
                    for k, v in payload["event_dates"].items():
                        db["event_dates"][k] = v
                
                with open(db_path, 'w', encoding='utf-8') as f:
                    json.dump(db, f, indent=4, ensure_ascii=False)
                
                print(f"[API CONFIG] Configurações salvas: faturamento R$ {db['revenue']:.2f}")
                self.wfile.write(json.dumps({"status": "success", "data": db}).encode('utf-8'))
                
            except Exception as e:
                print(f"[!] Erro ao salvar configurações: {e}")
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.wfile.write(json.dumps({"status": "error", "message": "Route not found"}).encode('utf-8'))

    def end_headers(self):
        # Desativa cache para arquivos estáticos também (facilita o desenvolvimento)
        if not self.path.startswith('/api/'):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

AC_URL = "https://acadiprev17727.api-us1.com/api/3/lists?limit=100"
AC_KEY = "8e34a8b9c73942e27ff4698ebf268e9cb1cdc60436742abd00e168acc4316ffcdf912a6a"

def active_campaign_updater():
    print("[ActiveCampaign] Background updater started.")
    while True:
        try:
            req = urllib.request.Request(AC_URL)
            req.add_header("Api-Token", AC_KEY)
            
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                
            total_waiting = 0
            found_lists = []
            for lst in res_data.get("lists", []):
                name = lst.get("name", "")
                if "eliteprev" in name.lower():
                    active_sub = int(lst.get("active_subscribers", 0))
                    total_waiting += active_sub
                    found_lists.append(f"{name}: {active_sub}")
            
            # Save to data.json
            db_path = os.path.join(os.getcwd(), 'data.json')
            if os.path.exists(db_path):
                with open(db_path, 'r', encoding='utf-8') as f:
                    db = json.load(f)
                
                # Only update if it changed
                if db.get("waiting_list") != total_waiting:
                    db["waiting_list"] = total_waiting
                    with open(db_path, 'w', encoding='utf-8') as f:
                        json.dump(db, f, indent=4, ensure_ascii=False)
                    print(f"[ActiveCampaign] Updated waiting_list to {total_waiting}. Lists: {', '.join(found_lists)}")
                    
        except Exception as e:
            print(f"[ActiveCampaign] Error updating lists: {e}")
            
        time.sleep(30) # Query every 30 seconds

def start_server():
    bg_dir = os.path.join(os.getcwd(), 'backgrounds')
    # Start ActiveCampaign updater thread
    ac_thread = threading.Thread(target=active_campaign_updater, daemon=True)
    ac_thread.start()
    if not os.path.exists(bg_dir):
        try:
            os.makedirs(bg_dir)
        except Exception:
            pass

    local_ip = get_local_ip()
    server_address = ('0.0.0.0', PORT)
    
    try:
        httpd = HTTPServer(server_address, MyHTTPRequestHandler)
    except Exception as e:
        print(f"[!] Erro ao iniciar o servidor na porta {PORT}: {e}")
        sys.exit(1)
        
    try:
        if sys.stdout.encoding != 'utf-8':
            sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print("\n" + "="*60)
    print("      [TV] SERVIDOR DE PAINEL CORPORATIVO INICIADO COM SUCESSO      ")
    print("="*60)
    print(f"\n[+] Servidor rodando localmente na porta: {PORT}")
    print(f"\n[>] Endereços de Acesso:")
    print(f"     -> Local:   http://localhost:{PORT}")
    print(f"     -> Rede:    http://{local_ip}:{PORT}")
    print(f"\n[>] Webhook da Hotmart escutando em:")
    print(f"     -> URL:     http://{local_ip}:{PORT}/api/webhook")
    print("\n" + "-"*60)
    print("Pressione [Ctrl + C] para parar o servidor a qualquer momento.")
    print("-"*60 + "\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Servidor encerrado. Até logo!")
        sys.exit(0)

if __name__ == "__main__":
    start_server()
