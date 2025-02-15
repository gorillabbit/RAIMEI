# シークレットは環境変数または直接指定（ここでは例として直接指定）
# .env.productionファイルから環境変数を読み込む
export $(grep -v '^#' .env.production | xargs)

# ペイロードの内容を読み込み、HMAC-SHA256署名を生成（opensslコマンドを使用）
echo "$GITHUB_WEBHOOK_SECRET"
cat ~/RAIMEI/test/payload.json
SIGNATURE=$(openssl dgst -sha256 -hmac "$GITHUB_WEBHOOK_SECRET" ~/RAIMEI/test/payload.json | sed 's/^.* //')
echo "Computed signature: sha256=$SIGNATURE"

curl -X POST "http://0.0.0.0:8000/webhook" \
     -H "Content-Type: application/json" \
     -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
     --data ~/RAIMEI/test/payload.json \
     --verbose