import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SESSION_LIFETIME=7*24*60*60*1000;
const TRUSTED_LIFETIME=30*24*60*60*1000;

function deviceLabel(userAgent=''){
  const agent=String(userAgent).slice(0,1000);
  const browser=/Edg\//.test(agent)?'Edge':/CriOS|Chrome\//.test(agent)?'Chrome':/FxiOS|Firefox\//.test(agent)?'Firefox':/Safari\//.test(agent)?'Safari':'Unknown browser';
  const device=/iPhone/.test(agent)?'iPhone':/iPad/.test(agent)?'iPad':/Android/.test(agent)?'Android':/Windows/.test(agent)?'Windows':/Macintosh|Mac OS X/.test(agent)?'macOS':/Linux/.test(agent)?'Linux':'Unknown device';
  return `${browser} on ${device}`;
}

export class SessionStore {
  constructor(filename){
    this.filename=filename;this.users=new Map();
    try{
      const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
      for(const [userId,list] of Object.entries(saved))this.users.set(userId,new Map((Array.isArray(list)?list:[]).filter(item=>item?.id&&item.createdAt&&item.expiresAt).map(item=>[item.id,item])));
    }catch(error){if(error.code!=='ENOENT')throw error;}
    this.prune();
  }
  create(userId,userAgent,{trusted=false}={}){
    const createdAt=new Date();const lifetime=trusted?TRUSTED_LIFETIME:SESSION_LIFETIME;
    const session={id:crypto.randomUUID(),device:deviceLabel(userAgent),trusted,createdAt:createdAt.toISOString(),expiresAt:new Date(createdAt.getTime()+lifetime).toISOString()};
    const list=this.users.get(userId)||new Map();list.set(session.id,session);this.users.set(userId,list);this.save();return {...session};
  }
  isActive(userId,sessionId){const session=this.users.get(userId)?.get(sessionId);return !!session&&Date.parse(session.expiresAt)>Date.now();}
  list(userId,currentId){
    this.prune();
    return [...(this.users.get(userId)?.values()||[])].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(session=>({...session,current:session.id===currentId}));
  }
  revoke(userId,sessionId){const list=this.users.get(userId);if(!list||!list.delete(sessionId))return false;if(!list.size)this.users.delete(userId);this.save();return true;}
  revokeOthers(userId,currentId){const list=this.users.get(userId);if(!list)return [];const revoked=[...list.keys()].filter(id=>id!==currentId);if(!revoked.length)return [];for(const id of revoked)list.delete(id);if(!list.size)this.users.delete(userId);this.save();return revoked;}
  prune(){
    let changed=false;const now=Date.now();
    for(const [userId,list] of this.users){for(const [id,session] of list){if(Date.parse(session.expiresAt)<=now){list.delete(id);changed=true;}}if(!list.size)this.users.delete(userId);}
    if(changed)this.save();
  }
  save(){
    const directory=path.dirname(this.filename);fs.mkdirSync(directory,{recursive:true,mode:0o700});
    const temporary=`${this.filename}.tmp`;fs.writeFileSync(temporary,JSON.stringify(Object.fromEntries([...this.users].map(([id,list])=>[id,[...list.values()]]))),{mode:0o600});fs.renameSync(temporary,this.filename);
  }
}

export {deviceLabel};
