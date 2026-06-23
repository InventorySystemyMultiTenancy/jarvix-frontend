# Jarvix Frontend

Painel web/PWA responsivo do assistente Jarvix.

## Desenvolvimento

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Por padrão, o frontend usa a API em `http://127.0.0.1:8765`. Em produção,
configure `VITE_API_URL` com a URL pública do backend antes do build.

## Build

```powershell
npm run build
```

Os arquivos finais ficam em `dist/` e podem ser publicados em hospedagens
estáticas como Cloudflare Pages, Vercel ou Netlify.
