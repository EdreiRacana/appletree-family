import requests

URL = "https://efsgxflltatbrbdvicxn.supabase.co/rest/v1/members"
KEY = "sb_publishable_9ZQ3UWaf9SbMdIheQmpEuQ_ifvb0YZW"

headers = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def fix_roberto():
    roberto_id = "1e0f6be5-728f-40ae-8a6a-b804afc0b0ba"
    santos_id = "00000000-0000-0000-0000-000000000100"
    lorena_id = "00000000-0000-0000-0000-000000000101"
    
    data = {
        "parents": [santos_id, lorena_id]
    }
    
    params = {"id": f"eq.{roberto_id}"}
    r = requests.patch(URL, headers=headers, params=params, json=data)
    if r.status_code in [200, 201, 204]:
        print("Roberto fixed successfully!")
    else:
        print(f"Error fixing Roberto: {r.status_code} {r.text}")

if __name__ == "__main__":
    fix_roberto()
