import requests

url = "http://127.0.0.1:5000/api/login"
resp = requests.post(url, json={"username": "test_farmer@test.com", "password": "password123"})
print("Login:", resp.status_code)
if resp.status_code != 200:
    print("Cannot login. Maybe need to register again if DB was wiped.")

cookies = resp.cookies
url_settings = "http://127.0.0.1:5000/users/settings"
resp2 = requests.post(url_settings, cookies=cookies, data={"ai_model": "gemini-1.5-flash", "ai_api_key": "key1,key2"}, allow_redirects=False)
print("Settings POST:", resp2.status_code)

url_me = "http://127.0.0.1:5000/api/me"
resp3 = requests.get(url_me, cookies=cookies)
print("Me GET:", resp3.json())
