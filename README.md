# Cafe Stock Tracker

Node.js + SQLite tabanlı stok takip paneli.

## Hızlı Başlangıç
```bash
npm install
npm run setup
npm start
```

Tarayıcı: `http://localhost:3000`

Varsayılan kullanıcılar:
- `admin / Admin123!`
- `manager1 / Manager123!`
- `manager2 / Manager123!`
- `guest / Guest123!`

## Public Yayınlama (Önerilen Ayarlar)
`.env` dosyası oluşturun:
```
PORT=3000
TRUST_PROXY=1
COOKIE_SECURE=1
DISABLE_GUEST=1
SOURCE_HTML_DIR=./supplier_html
```

Notlar:
- `COOKIE_SECURE=1` HTTPS altında cookie güvenliği içindir.
- `DISABLE_GUEST=1` ile login olmadan erişim kapatılır.

## Nginx Reverse Proxy Örneği (/boston)
```
server {
  listen 443 ssl;
  server_name mncguclendirme.com;

  location /boston/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## GitHub Repo’ya Yükleme
1. GitHub’da **boş repo** oluşturun (README eklemeyin).
2. Bu klasörde:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<kullanici>/<repo>.git
git push -u origin main
```
