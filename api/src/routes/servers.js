const express=require('express');
const {serverAction,serverProvision,serverStatus,serverConsole}=require('../services/agentClient');
const router=express.Router();
function cfg(res){const agentUrl=process.env.AGENT_URL,secret=process.env.AGENT_SHARED_SECRET;if(!agentUrl||!secret){res.status(503).json({error:'Agente não configurado.'});return null}return {agentUrl,secret}}
router.get('/:id/status',async(req,res)=>{const c=cfg(res);if(!c)return;try{res.json(await serverStatus({...c,serverId:req.params.id}))}catch(e){res.status(502).json({error:e.message})}});
router.get('/:id/console',async(req,res)=>{const c=cfg(res);if(!c)return;try{res.json(await serverConsole({...c,serverId:req.params.id}))}catch(e){res.status(502).json({error:e.message})}});
router.post('/:id/action',async(req,res)=>{const action=req.body?.action;if(!['start','stop','restart'].includes(action))return res.status(400).json({error:'Ação inválida.'});const c=cfg(res);if(!c)return;try{res.json(await serverAction({...c,serverId:req.params.id,action}))}catch(e){res.status(502).json({error:e.message})}});
module.exports=router;
