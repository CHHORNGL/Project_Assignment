import requests

url = "http://localhost:5000/auth/reset-password-api"
res = requests.post(url, json={"action": "send_code", "email": "iks214262@gmail.com"})
print("Send Code:", res.status_code, res.text)
