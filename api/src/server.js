const express=require('express'),path=require('path'),fs=require('fs'),crypto=require('crypto');
const plans=require('../../config/plans.json');
const serverRoutes=require('./routes/servers');
const {serverProvision}=require('./services/agentClient');
const {readUsers,createUser,ensureTestAccount,makeToken,getUserFromToken,safeUser,verifyPassword,cookieOptions}=require('./auth');
const app=express();
app.use(express.json());
app.use(express.static(path.join(__dirname,'..','..','web','public')));
ensureTestAccount();

function currentUser(req){const m=(req.headers.cookie||'').match(/(?:^|; )kp_session=([^;]+)/);return getUserFromToken(m?decodeURIComponent(m[1]):null)}
function requireAuth(req,res,next){const user=currentUser(req);if(!user)return res.status(401).json({error:'Faça login para continuar.'});req.user=user;next()}
function saveServer(s){const file=path.join(__dirname,'..','data','servers.json');fs.mkdirSync(path.dirname(file),{recursive:true});let arr=[];if(fs.existsSync(file)){try{arr=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}}arr.push(s);fs.writeFileSync(file,JSON.stringify(arr,null,2));}
function readServers(){const file=path.join(__dirname,'..','data','servers.json');if(!fs.existsSync(file))return [];try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return []}}
function allocatePort(){const used=new Set(readServers().map(s=>Number(s.port)).filter(Number.isInteger));let port=Number(process.env.KP_HOSTS_PORT_START||25565);if(!Number.isInteger(port)||port<1024||port>65500)port=25565;while(used.has(port))port++;return port}
function publicHost(){return String(process.env.KP_HOSTS_HOSTNAME||'kphost.ddns.net').trim().replace(/^https?:\/\//,'').replace(/\/$/,'')}

app.get('/api/plans',(_,r)=>r.json(plans.plans));
app.get('/api/me',(req,res)=>res.json({user:safeUser(currentUser(req))}));
app.post('/api/auth/register',(req,res)=>{try{const u=createUser(req.body?.username,req.body?.email,req.body?.password);const token=makeToken(u);res.setHeader('Set-Cookie',`kp_session=${encodeURIComponent(token)}; ${cookieOptions()}`);res.status(201).json({user:safeUser(u)})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/auth/login',(req,res)=>{const username=String(req.body?.username||'').trim();const password=String(req.body?.password||'');const u=readUsers().find(x=>x.username.toLowerCase()===username.toLowerCase());if(!u||!verifyPassword(password,u.passwordSalt,u.passwordHash))return res.status(401).json({error:'Usuário ou senha incorretos.'});const token=makeToken(u);res.setHeader('Set-Cookie',`kp_session=${encodeURIComponent(token)}; ${cookieOptions()}`);res.json({user:safeUser(u)})});
app.post('/api/auth/logout',(req,res)=>{res.setHeader('Set-Cookie','kp_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');res.json({ok:true})});

app.get('/api/dashboard',requireAuth,(req,res)=>{const mine=readServers().filter(s=>s.ownerId===req.user.id);res.json({user:safeUser(req.user),plans:plans.plans,servers:mine,permissions:{unlocked:req.user.unlocked,paymentExempt:req.user.paymentExempt,allPlans:req.user.unlocked}})});
app.post('/api/servers/create',requireAuth,async(req,res)=>{
  const {planId,serverName}=req.body||{};const plan=plans.plans.find(p=>p.id===planId);if(!plan||!serverName)return res.status(400).json({error:'Informe um plano e nome de servidor.'});
  if(!req.user.paymentExempt)return res.status(402).json({error:'Pagamento necessário. Use o checkout da Kiwify.'});
  const safeName=String(serverName).trim().replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,32);if(!safeName)return res.status(400).json({error:'Nome de servidor inválido.'});
  const port=allocatePort();const host=publicHost();const s={id:crypto.randomUUID(),ownerId:req.user.id,name:safeName,planId:plan.id,ram_mb:plan.ram_mb,status:'provisioning',freeTest:true,port,host,address:`${host}:${port}`,createdAt:new Date().toISOString()};saveServer(s);
  const agentUrl=process.env.AGENT_URL,secret=process.env.AGENT_SHARED_SECRET;
  if(agentUrl&&secret){
    try{
      const result=await serverProvision({agentUrl,secret,serverId:s.id,maxRamMb:plan.ram_mb,port});
      s.status=result.status||'ready';
      s.version=result.version||'latest';
      const all=readServers().map(x=>x.id===s.id?s:x);
      fs.writeFileSync(path.join(__dirname,'..','data','servers.json'),JSON.stringify(all,null,2));
      return res.status(201).json({server:s,provision:result,message:'Servidor criado e arquivos oficiais do Minecraft baixados automaticamente.'});
    }catch(e){
      s.status='provision_error';
      s.error=e.message;
      const all=readServers().map(x=>x.id===s.id?s:x);
      fs.writeFileSync(path.join(__dirname,'..','data','servers.json'),JSON.stringify(all,null,2));
      return res.status(502).json({server:s,error:'O servidor foi criado, mas o download/provisionamento falhou: '+e.message});
    }
  }
  res.status(201).json({server:s,message:'Servidor criado. Configure AGENT_URL e AGENT_SHARED_SECRET para baixar os arquivos automaticamente.'});
});

app.post('/api/orders',(req,res)=>{const {planId,customerName,email,serverName}=req.body||{};const plan=plans.plans.find(p=>p.id===planId);if(!plan||!customerName||!email||!serverName)return res.status(400).json({error:'Dados inválidos.'});res.json({orderId:'KP-'+Math.random().toString(36).slice(2,10).toUpperCase(),status:'redirect_to_kiwify',plan,message:'Finalize o pagamento no checkout da Kiwify.'})});
app.post('/api/webhooks/kiwify',(req,res)=>{console.log('[Kiwify webhook]',JSON.stringify(req.body));res.status(200).json({received:true})});
app.use('/api/servers',serverRoutes);
app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Rota não encontrada.'});res.sendFile(path.join(__dirname,'..','..','web','public','index.html'))});
module.exports = app;

if (require.main === module) {
  app.listen(process.env.PORT||3000,()=>console.log('KP HOSTS API/site iniciado.'));
}
