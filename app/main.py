from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()


@app.post("/webhook")
async def github_webhook(request: Request):
    payload = await request.json()
    # ここでGitHubイベント（Issue、PR）の解析処理を実装
    # 例: payload["action"]やpayload["issue"]["title"]など
    return {"status": "received"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
