
import os
import requests

token = os.getenv("GITHUB_TOKEN")
<<<<<<< HEAD

if not token:
    raise SystemExit("GITHUB_TOKEN environment variable is missing.")

=======
>>>>>>> 26d9c81 (fixup! Add Jinja2 templates, static assets, project data)
repo_name = "Gig-Ledger"
api_url = "https://api.github.com/user/repos"

headers = {
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json"
}

payload = {
    "name": repo_name,
    "private": False,
    "description": "GigLedger website for Prasunex Innovathon 2026"
}

try:
    response = requests.post(
        api_url,
        headers=headers,
        json=payload,
        timeout=30
    )

    if response.status_code == 201:
        print("Repository created successfully.")
    elif response.status_code == 422:
        print("Repository may already exist.")
    else:
        print(f"Failed: HTTP {response.status_code}")
        print(response.text)

except requests.RequestException as error:
    print(f"Request failed: {error}")
