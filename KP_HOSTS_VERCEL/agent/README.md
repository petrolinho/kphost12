# KP HOSTS Agent

O Agent roda no node e faz o provisionamento dos servidores Minecraft.

## Provisionamento automático
Quando a API cria um servidor, ela chama `POST /servers/:id/provision`. O Agent:

1. Consulta o manifesto oficial do Minecraft Java Edition.
2. Descobre a última versão estável.
3. Baixa o `server.jar` oficial do domínio `piston-data.mojang.com`.
4. Cria `eula.txt` com `eula=false` para que a decisão do EULA seja feita pelo administrador.
5. Cria `server.properties`, `server.config.json`, `plugins/` e `world/`.

O download é restrito a HTTPS e a um domínio oficial autorizado; não existe endpoint para baixar URLs arbitrárias.

## Requisitos
- Node.js 18+
- Java compatível com a versão do Minecraft instalada no node
- `AGENT_SHARED_SECRET` igual ao da API
- `MC_SERVERS_DIR` apontando para o diretório dos servidores
