const express=require('express');
const {spawn,execFile}=require('child_process');
const fs=require('fs');
const path=require('path');
const os=require('os');
const app=express();
app.use(express.json({limit:'64kb'}));
const PORT=Number(process.env.AGENT_PORT||8787);
const SECRET=process.env.AGENT_SHARED_SECRET||'';
const BASE=process.env.MC_SERVERS_DIR||path.join(process.cwd(),'servers');
const MANIFEST_URL='https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const ALLOWED_DOWNLOAD_HOST='piston-data.mojang.com';
const MAX_JAR_BYTES=150*1024*1024;
const MAX_CONSOLE_LINES=250;
fs.mkdirSync(BASE,{recursive:true});
function auth(req,res,next){if(!SECRET||req.get('x-kp-agent-secret')!==SECRET)return res.status(401).json({error:'Unauthorized'});next()}
function serverDir(id){if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id))throw Error('Invalid server id');return path.join(BASE,id)}
function metaPath(dir){return path.join(dir,'.kp-process.json')}
function configPath(dir){return path.join(dir,'server.config.json')}
function logPath(dir){return path.join(dir,'server.log')}
function readConfig(dir){let cfg={maxRamMb:2048};try{const raw=JSON.parse(fs.readFileSync(configPath(dir),'utf8'));const mb=Number(raw.maxRamMb);if(Number.isInteger(mb)&&mb>=256&&mb<=65536)cfg.maxRamMb=mb}catch(_){}return cfg}
function readMeta(dir){try{return JSON.parse(fs.readFileSync(metaPath(dir),'utf8'))}catch(_){return null}}
function isPidRunning(pid){if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true}catch(_){return false}}
function writeMeta(dir,m){fs.writeFileSync(metaPath(dir),JSON.stringify(m,null,2))}
function clearMeta(dir){try{fs.unlinkSync(metaPath(dir))}catch(_){} }
function tailFile(file,lines=MAX_CONSOLE_LINES){if(!fs.existsSync(file))return '';return fs.readFileSync(file,'utf8').split(/\r?\n/).slice(-lines).join('\n')}
function directorySize(dir){let total=0,stack=[dir];while(stack.length){const cur=stack.pop();let entries=[];try{entries=fs.readdirSync(cur,{withFileTypes:true})}catch(_){continue}for(const e of entries){if(e.name==='.kp-process.json')continue;const full=path.join(cur,e.name);try{if(e.isDirectory())stack.push(full);else total+=fs.statSync(full).size}catch(_){} }}return total}
function stopProcess(pid){return new Promise((resolve,reject)=>{if(!isPidRunning(pid))return resolve('already_stopped');if(process.platform==='win32'){execFile('taskkill',['/PID',String(pid),'/T','/F'],err=>err?reject(err):resolve('stopped'))}else{try{process.kill(pid,'SIGTERM');resolve('stopped')}catch(e){reject(e)}}})}
async function fetchJson(url){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`Download HTTP ${r.status}`);return r.json()}
async function downloadJar(url,dest){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!==ALLOWED_DOWNLOAD_HOST)throw Error('Fonte de download não autorizada.');const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!r.ok||!r.body)throw Error(`Download do server.jar falhou (HTTP ${r.status})`);const len=Number(r.headers.get('content-length')||0);if(len>MAX_JAR_BYTES)throw Error('server.jar excede o limite permitido.');const tmp=dest+'.download';const file=fs.createWriteStream(tmp);let total=0;try{for await(const chunk of r.body){total+=chunk.length;if(total>MAX_JAR_BYTES)throw Error('server.jar excede o limite permitido.');file.write(chunk)}file.end();await new Promise((res,rej)=>{file.on('finish',res);file.on('error',rej)});fs.renameSync(tmp,dest)}catch(e){try{file.destroy()}catch(_){}try{fs.unlinkSync(tmp)}catch(_){}throw e}}
async function provisionServer(id,maxRamMb,port){const dir=serverDir(id);fs.mkdirSync(dir,{recursive:true});const mb=Number(maxRamMb);if(!Number.isInteger(mb)||mb<512||mb>65536)throw Error('RAM inválida para o servidor.');const p=Number(port);if(!Number.isInteger(p)||p<1024||p>65500)throw Error('Porta inválida para o servidor.');
  const manifest=await fetchJson(MANIFEST_URL);const release=manifest.versions?.find(v=>v.id===manifest.latest?.release&&v.type==='release');if(!release)throw Error('Não foi possível descobrir a versão estável atual do Minecraft.');
  const versionMeta=await fetchJson(release.url);const jarUrl=versionMeta.downloads?.server?.url;if(!jarUrl)throw Error('A versão escolhida não possui server.jar oficial.');
  const jar=path.join(dir,'server.jar');if(!fs.existsSync(jar))await downloadJar(jarUrl,jar);
  fs.writeFileSync(configPath(dir),JSON.stringify({maxRamMb:mb,port:p,version:release.id,source:'official-mojang'},null,2));
  if(!fs.existsSync(path.join(dir,'eula.txt')))fs.writeFileSync(path.join(dir,'eula.txt'),'# Gerado pela KP HOSTS.\n# Aceite o EULA do Minecraft manualmente antes de iniciar o servidor.\neula=false\n');
  const props=path.join(dir,'server.properties');if(!fs.existsSync(props)){fs.writeFileSync(props,`server-port=${p}\nmotd=KP HOSTS\nmax-players=20\nonline-mode=true\n`)}else{let txt=fs.readFileSync(props,'utf8');if(/^server-port=.*$/m.test(txt))txt=txt.replace(/^server-port=.*$/m,`server-port=${p}`);else txt+=`\nserver-port=${p}\n`;fs.writeFileSync(props,txt)}
  for(const d of ['plugins','world'])fs.mkdirSync(path.join(dir,d),{recursive:true});
  return {status:'ready',version:release.id,serverJar:'server.jar',files:['server.jar','eula.txt','server.properties','server.config.json','plugins/','world/'],maxRamMb:mb,port:p};
}
function startServer(id){const dir=serverDir(id);if(!fs.existsSync(dir))throw Error('Server not found');const jar=path.join(dir,'server.jar');if(!fs.existsSync(jar))throw Error('server.jar not found');const old=readMeta(dir);if(old&&isPidRunning(Number(old.pid)))return {result:'already_running',pid:Number(old.pid)};const cfg=readConfig(dir);const logFd=fs.openSync(logPath(dir),'a');const child=spawn('java',['-Xms128M',`-Xmx${cfg.maxRamMb}M`,'-jar','server.jar','nogui'],{cwd:dir,detached:true,stdio:['ignore',logFd,logFd]});child.on('error',e=>{console.error(`[${id}]`,e.message);try{fs.closeSync(logFd)}catch(_){}});child.on('exit',()=>{clearMeta(dir);try{fs.closeSync(logFd)}catch(_){}});child.unref();writeMeta(dir,{pid:child.pid,startedAt:new Date().toISOString(),maxRamMb:cfg.maxRamMb});return {result:'started',pid:child.pid,maxRamMb:cfg.maxRamMb}}
async function action(id,a){const dir=serverDir(id);if(!fs.existsSync(dir))throw Error('Server not found');if(a==='start')return startServer(id);const meta=readMeta(dir),pid=Number(meta?.pid);if(a==='stop'){const result=await stopProcess(pid);clearMeta(dir);return {result}}if(a==='restart'){if(isPidRunning(pid))await stopProcess(pid);clearMeta(dir);await new Promise(r=>setTimeout(r,700));return startServer(id)}throw Error('Invalid action')}
function status(id){const dir=serverDir(id);if(!fs.existsSync(dir))throw Error('Server not found');const meta=readMeta(dir),running=isPidRunning(Number(meta?.pid));if(!running&&meta)clearMeta(dir);const cfg=readConfig(dir);return {serverId:id,status:running?'online':'offline',pid:running?Number(meta.pid):null,startedAt:running?meta.startedAt:null,maxRamMb:cfg.maxRamMb,diskBytes:directorySize(dir),platform:os.platform()}}
app.get('/health',(_,r)=>r.json({ok:true,service:'kp-hosts-agent'}));
app.get('/servers/:id/status',auth,(req,res)=>{try{res.json(status(req.params.id))}catch(e){res.status(400).json({error:e.message})}});
app.get('/servers/:id/console',auth,(req,res)=>{try{const dir=serverDir(req.params.id);if(!fs.existsSync(dir))throw Error('Server not found');res.json({serverId:req.params.id,console:tailFile(logPath(dir))})}catch(e){res.status(400).json({error:e.message})}});
app.post('/servers/:id/provision',auth,async(req,res)=>{try{res.json({ok:true,serverId:req.params.id,...await provisionServer(req.params.id,req.body?.maxRamMb,req.body?.port)})}catch(e){res.status(400).json({error:e.message})}});
app.post('/servers/:id/action',auth,async(req,res)=>{try{const a=req.body?.action;if(!['start','stop','restart'].includes(a))return res.status(400).json({error:'Invalid action'});res.json({ok:true,serverId:req.params.id,...await action(req.params.id,a)})}catch(e){res.status(400).json({error:e.message})}});
app.listen(PORT,'127.0.0.1',()=>console.log(`KP HOSTS Agent on 127.0.0.1:${PORT}`));
