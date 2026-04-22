import requests
import os

URL = "https://efsgxflltatbrbdvicxn.supabase.co/rest/v1/members"
KEY = "sb_publishable_9ZQ3UWaf9SbMdIheQmpEuQ_ifvb0YZW"

headers = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json"
}

def check_member(name):
    params = {"first_name": f"eq.{name}", "select": "*"}
    r = requests.get(URL, headers=headers, params=params)
    if r.status_code == 200:
        print(f"--- {name} ---")
        for m in r.json():
            print(m)
    else:
        print(f"Error checking {name}: {r.status_code} {r.text}")

if __name__ == "__main__":
    check_member("Elena")
    check_member("Valentina")
    check_member("Santos")
    check_member("Roberto")
    check_member("Lorena")
