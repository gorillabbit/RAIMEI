import hmac
import hashlib
import os
from fastapi import FastAPI, Request, HTTPException
from starlette.status import HTTP_403_FORBIDDEN

app = FastAPI()

GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET")


def verify_signature(secret: str, body: bytes, signature_header: str) -> bool:
    """
    GitHubが送るX-Hub-Signature-256ヘッダーを検証する関数
    """
    sha_name, signature = signature_header.split("=")
    if sha_name != "sha256":
        return False
    # HMAC-SHA256で計算
    mac = hmac.new(secret.encode(), msg=body, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)


@app.post("/webhook")
async def github_webhook(request: Request):
    print(request)
    print(request.headers)
    # GitHubから送られるシグネチャヘッダーを取得
    signature_header = request.headers.get("X-Hub-Signature-256")
    print(signature_header)
    if signature_header is None:
        raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Signature missing")

    body = await request.body()

    # シグネチャ検証
    if not verify_signature(GITHUB_WEBHOOK_SECRET, body, signature_header):
        raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Invalid signature")

    # JSONデータとしてパース
    payload = await request.json()
    event_type = request.headers.get("X-GitHub-Event", "unknown")

    # ここでイベントごとの処理を実装（例：Issue、Pull Requestなど）
    if event_type == "issues":
        action = payload.get("action")
        issue = payload.get("issue", {}).get("title", "No Title")
        print(f"Issue event received: action={action}, title={issue}")
    elif event_type == "pull_request":
        action = payload.get("action")
        pr = payload.get("pull_request", {}).get("title", "No Title")
        print(f"Pull Request event received: action={action}, title={pr}")
    else:
        print(f"Other event received: {event_type}")

    return {"status": "success", "event": event_type}


if __name__ == "__main__":
    import uvicorn

    print("Starting server...")

    uvicorn.run(app, host="0.0.0.0", port=8000)
