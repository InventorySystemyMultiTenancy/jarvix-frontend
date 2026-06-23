# Jarvix Frontend

Painel web/PWA responsivo do assistente Jarvix, com login, cadastro e memória
individual por cliente.

## Desenvolvimento

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Por padrão, o frontend usa a API em `http://127.0.0.1:8765`.

## Produção

Configure antes do build:

```env
VITE_API_BASE=https://seu-backend.onrender.com
VITE_DESKTOP_DOWNLOAD_URL=https://github.com/InventorySystemyMultiTenancy/jarvix-backend/releases/latest/download/Jarvix-Windows-x64.zip
```

No backend, inclua o domínio público do frontend em `JARVIX_ALLOWED_ORIGINS`.

## Build

```powershell
npm run build
```

Os arquivos finais ficam em `dist/` e podem ser publicados em hospedagens estáticas
como Render Static Site, Cloudflare Pages, Vercel ou Netlify.
