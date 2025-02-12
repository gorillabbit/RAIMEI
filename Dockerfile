# ベースイメージとして公式の Python 3.12-slim を使用
FROM python:3.12-slim

# 作業ディレクトリを設定
WORKDIR /app

# 依存関係ファイルをコピー
COPY app/requirements.txt .

# 依存関係をインストール
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY ./app ./app

# コンテナがリッスンするポートを指定
EXPOSE 8000

# アプリケーションの起動コマンドを設定
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
