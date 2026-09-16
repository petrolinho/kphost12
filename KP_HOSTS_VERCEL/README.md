# KP HOSTS — Contas + Kiwify + Provisionamento automático

A KP HOSTS agora cria contas, mantém a conta de teste `teste123`/`12234`, possui checkout Kiwify e pode provisionar automaticamente os arquivos oficiais do Minecraft Java Edition no node.

## Como funciona
Cliente/conta → API → Agent → manifesto oficial do Minecraft → `server.jar` → arquivos básicos → painel.

Ao criar um servidor, a API chama o Agent. O Agent baixa a versão estável mais recente do servidor Java oficial. O Minecraft exige uma versão compatível do Java para executar o servidor. Fonte oficial: https://www.minecraft.net/pt-br/download/server

O `eula.txt` é criado com `eula=false`; a aceitação do EULA não é feita automaticamente.

## Rodar
### API
```bash
cd api
npm install
npm start
```
Abra `http://localhost:3000`.

### Agent
```bash
cd agent
npm install
```
Configure `AGENT_PORT`, `AGENT_SHARED_SECRET` e `MC_SERVERS_DIR` a partir de `.env.example`, depois:
```bash
npm start
```

## Importante
O download automático depende de o Agent estar configurado e com acesso à internet. Antes de produção, use HTTPS, autenticação/autorização por servidor, banco de dados, firewall e uma rede privada entre API e Agent.

## Endereço público No-IP

A configuração usa `kphost.ddns.net` como endereço público. Cada servidor recebe uma porta exclusiva a partir de `KP_HOSTS_PORT_START` (padrão `25565`) e o painel mostra `kphost.ddns.net:PORTA`.

No Windows, no roteador da rede, encaminhe as portas TCP usadas pelos servidores para o computador que executa o Agent. Para uma hospedagem pública real, o ideal é colocar o Agent em um servidor/VPS com IP público e regras de firewall adequadas.
