import urllib.request
import json

url = "http://localhost:8000/api/webhook"
payload = {
    "name": "Comprador Teste Antigravity",
    "price": 5000.00,
    "prod": "Produto Teste Automatizado"
}
data = json.dumps(payload).encode('utf-8')

req = urllib.request.Request(
    url, 
    data=data, 
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as response:
        print("Status Code:", response.getcode())
        print("Response:", response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
