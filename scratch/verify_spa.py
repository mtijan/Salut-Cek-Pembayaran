import urllib.request
import json

base_url = 'http://127.0.0.1:8000'

# 1. Test Admin SPA root
req = urllib.request.Request(f'{base_url}/admin')
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8')
    assert resp.status == 200
    assert '<div id="root"></div>' in html
    print("1. Admin SPA index.html served OK (Status 200)")

# 2. Test Login API with super_admin
login_req = urllib.request.Request(
    f'{base_url}/api/admin/login',
    data=json.dumps({'email': 'admin@salut.local', 'password': 'admin123'}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(login_req) as resp:
    res = json.loads(resp.read().decode())
    cookie = resp.headers.get('Set-Cookie')
    assert res['success'] is True
    print(f"2. Admin Login OK: {res['data']['email']} -> {res['data']['role']}")

# 3. Test Dashboard Stats
stats_req = urllib.request.Request(f'{base_url}/api/admin/dashboard/stats', headers={'Cookie': cookie})
with urllib.request.urlopen(stats_req) as resp:
    res = json.loads(resp.read().decode())
    assert res['success'] is True
    print(f"3. Dashboard Stats OK: {res['data']['total_students']} students, {res['data']['payment_rate_percentage']}%")

# 4. Test Public Lookup
lookup_req = urllib.request.Request(
    f'{base_url}/api/lookup',
    data=json.dumps({'nim': '021810557'}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(lookup_req) as resp:
    res = json.loads(resp.read().decode())
    assert res['success'] is True
    print(f"4. Public Lookup OK: {res['data']['student']['nim']} -> {res['data']['student']['full_name']}")

print("\nALL BACKEND & SPA TESTS PASSED!")
