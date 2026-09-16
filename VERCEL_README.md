# KP HOSTS — Vercel

## Publicação

1. Crie um projeto na Vercel e importe este projeto.
2. Deixe o framework como Other.
3. O arquivo `vercel.json` já direciona as rotas para `api/index.js`.
4. Configure as variáveis de ambiente no painel da Vercel:
   - `KP_HOSTS_HOSTNAME=kphost.ddns.net`
   - `KP_HOSTS_PORT_START=25565`
   - `SESSION_SECRET=` uma senha aleatória longa
   - `AGENT_URL=` e `AGENT_SHARED_SECRET=` somente se o Agent estiver acessível pela Vercel.
5. Faça Deploy.

## Importante

A Vercel é serverless. Os arquivos JSON em `api/data` são incluídos como dados iniciais, mas o sistema não deve usar escrita em disco como banco de produção: alterações podem ser perdidas entre execuções/instâncias.

Para uma versão de produção, troque `users.json` e `servers.json` por um banco externo (por exemplo, Postgres/Supabase/Neon) e mantenha o Agent/Minecraft fora da Vercel.

O Agent atual continua sendo executado na máquina que hospeda os servidores Minecraft. A Vercel hospeda o site/API, não os processos Minecraft.

## Desenvolvimento local

```bash
npm install
npm start
```

Abra `http://localhost:3000`.
