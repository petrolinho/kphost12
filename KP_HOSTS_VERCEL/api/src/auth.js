const crypto=require('crypto');

const USERS_FILE=require('path').join(__dirname,'..','data','users.json');
const fs=require('fs');
function ensureData(){fs.mkdirSync(require('path').dirname(USERS_FILE),{recursive:true}); if(!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE,'[]');}
function readUsers(){ensureData(); try{return JSON.parse(fs.readFileSync(USERS_FILE,'utf8'))}catch{return []}}
function writeUsers(users){ensureData(); fs.writeFileSync(USERS_FILE,JSON.stringify(users,null,2));}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}}
function verifyPassword(password,salt,hash){const a=Buffer.from(hash,'hex');const b=crypto.scryptSync(password,salt,64);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function makeToken(user){
  const payload=Buffer.from(JSON.stringify({id:user.id,username:user.username,exp:Date.now()+1000*60*60*24*7})).toString('base64url');
  const secret=process.env.SESSION_SECRET||'kp-hosts-dev-change-this-secret';
  const sig=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function getUserFromToken(token){
  if(!token||!token.includes('.'))return null;
  const [payload,sig]=token.split('.'); const secret=process.env.SESSION_SECRET||'kp-hosts-dev-change-this-secret';
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
  if(sig!==expected)return null;
  try{const p=JSON.parse(Buffer.from(payload,'base64url').toString());if(p.exp<Date.now())return null;return readUsers().find(u=>u.id===p.id)||null}catch{return null}
}
function safeUser(u){if(!u)return null; const {passwordHash,passwordSalt,...safe}=u; return safe}
function createUser(username,email,password,options={}){
  username=String(username||'').trim();email=String(email||'').trim().toLowerCase();
  if(!/^[a-zA-Z0-9_.-]{3,32}$/.test(username))throw new Error('Usuário inválido.');
  if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('E-mail inválido.');
  if(String(password||'').length<5)throw new Error('A senha precisa ter pelo menos 5 caracteres.');
  const users=readUsers(); if(users.some(u=>u.username.toLowerCase()===username.toLowerCase()))throw new Error('Usuário já existe.');
  if(users.some(u=>u.email===email))throw new Error('E-mail já cadastrado.');
  const hp=hashPassword(password); const user={id:crypto.randomUUID(),username,email,passwordHash:hp.hash,passwordSalt:hp.salt,role:options.role||'customer',paymentExempt:!!options.paymentExempt,unlocked:!!options.unlocked,createdAt:new Date().toISOString()};
  users.push(user);writeUsers(users);return user;
}
function ensureTestAccount(){
  const users=readUsers(); if(users.some(u=>u.username==='teste123'))return;
  createUser('teste123','teste123@kphosts.local','12234',{role:'test',paymentExempt:true,unlocked:true});
}
function cookieOptions(){return 'HttpOnly; Path=/; SameSite=Lax; Max-Age=604800'}
module.exports={readUsers,createUser,ensureTestAccount,makeToken,getUserFromToken,safeUser,cookieOptions,verifyPassword};
