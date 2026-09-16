async function call({agentUrl,secret,pathSuffix,method='GET',body}){
 const r=await fetch(`${agentUrl}/servers/${encodeURIComponent(pathSuffix.serverId)}/${pathSuffix.route}`,{method,headers:{'content-type':'application/json','x-kp-agent-secret':secret},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({error:'Resposta inválida do Agent'}));
 if(!r.ok) throw Error(data.error||`Agent HTTP ${r.status}`);
 return data;
}
async function serverAction({agentUrl,secret,serverId,action}){return call({agentUrl,secret,pathSuffix:{serverId,route:'action'},method:'POST',body:{action}})}
async function serverProvision({agentUrl,secret,serverId,maxRamMb,port}){return call({agentUrl,secret,pathSuffix:{serverId,route:'provision'},method:'POST',body:{maxRamMb,port}})}
async function serverStatus({agentUrl,secret,serverId}){return call({agentUrl,secret,pathSuffix:{serverId,route:'status'}})}
async function serverConsole({agentUrl,secret,serverId}){return call({agentUrl,secret,pathSuffix:{serverId,route:'console'}})}
module.exports={serverAction,serverProvision,serverStatus,serverConsole};
