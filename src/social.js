import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {cleanText} from './store.js';

const pairKey=(a,b)=>[a,b].sort().join('\0');

export class SocialStore {
  constructor(filename) {
    this.filename=filename;
    this.requests=new Map();
    this.friends=new Set();
    this.blocks=[];
    this.reports=[];
    try {
      const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
      for(const item of saved.requests||[])if(item?.id&&item.from&&item.to)this.requests.set(item.id,item);
      for(const item of saved.friends||[])if(Array.isArray(item)&&item.length===2)this.friends.add(pairKey(item[0],item[1]));
      this.blocks=(saved.blocks||[]).filter(item=>item?.by&&item?.target);
      this.reports=(saved.reports||[]).filter(item=>item?.id&&item.reporter&&item.target);
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  isFriend(a,b){return this.friends.has(pairKey(a,b));}
  isBlockedBetween(a,b){return this.blocks.some(item=>(item.by===a&&item.target===b)||(item.by===b&&item.target===a));}
  relationship(a,b){
    const pending=[...this.requests.values()].find(item=>item.status==='pending'&&((item.from===a&&item.to===b)||(item.from===b&&item.to===a)));
    return {friend:this.isFriend(a,b),blockedByMe:this.blocks.some(item=>item.by===a&&item.target===b),blockedByThem:this.blocks.some(item=>item.by===b&&item.target===a),incoming:pending?.to===a?pending.id:null,outgoing:pending?.from===a?pending.id:null};
  }
  request(from,to){
    if(!from||!to||from===to)throw new Error('Choose another user.');
    if(this.isBlockedBetween(from,to))throw new Error('This user is blocked. Unblock them before continuing.');
    if(this.isFriend(from,to))return {status:'friends'};
    const pending=[...this.requests.values()].find(item=>item.status==='pending'&&((item.from===from&&item.to===to)||(item.from===to&&item.to===from)));
    if(pending?.from===from)return {status:'pending',request:pending};
    if(pending?.to===from){pending.status='accepted';pending.updatedAt=new Date().toISOString();this.friends.add(pairKey(from,to));this.save();return {status:'friends',request:pending};}
    const request={id:crypto.randomUUID(),from,to,status:'pending',createdAt:new Date().toISOString()};
    this.requests.set(request.id,request);this.save();return {status:'pending',request};
  }
  respond(userId,requestId,action){
    const item=this.requests.get(requestId);
    if(!item||item.to!==userId||item.status!=='pending')throw new Error('Friend request not found.');
    if(!['accept','decline'].includes(action))throw new Error('Choose accept or decline.');
    item.status=action==='accept'?'accepted':'declined';item.updatedAt=new Date().toISOString();
    if(action==='accept')this.friends.add(pairKey(item.from,item.to));
    this.save();return item;
  }
  block(by,target){
    if(!by||!target||by===target)throw new Error('Choose another user.');
    if(this.blocks.some(item=>item.by===by&&item.target===target))return false;
    this.blocks.push({by,target,createdAt:new Date().toISOString()});
    this.friends.delete(pairKey(by,target));
    for(const item of this.requests.values())if(item.status==='pending'&&((item.from===by&&item.to===target)||(item.from===target&&item.to===by))){item.status='blocked';item.updatedAt=new Date().toISOString();}
    this.save();return true;
  }
  unblock(by,target){const before=this.blocks.length;this.blocks=this.blocks.filter(item=>item.by!==by||item.target!==target);if(this.blocks.length!==before)this.save();return this.blocks.length!==before;}
  friendsFor(userId){return [...this.friends].map(key=>key.split('\0')).filter(pair=>pair.includes(userId)).map(pair=>pair.find(id=>id!==userId));}
  blockedFor(userId){return this.blocks.filter(item=>item.by===userId).map(item=>item.target);}
  incomingFor(userId){return [...this.requests.values()].filter(item=>item.to===userId&&item.status==='pending');}
  outgoingFor(userId){return [...this.requests.values()].filter(item=>item.from===userId&&item.status==='pending');}
  report(reporter,target,category,details){
    if(!reporter||!target||reporter===target)throw new Error('Choose another user.');
    if(!['spam','abuse','inappropriate','other'].includes(category))throw new Error('Choose a report category.');
    const report={id:crypto.randomUUID(),reporter,target,category,details:cleanText(details,500),status:'open',createdAt:new Date().toISOString()};
    this.reports.push(report);this.save();return report;
  }
  save(){
    const dir=path.dirname(this.filename);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;
    fs.writeFileSync(tmp,JSON.stringify({requests:[...this.requests.values()],friends:[...this.friends].map(key=>key.split('\0')),blocks:this.blocks,reports:this.reports}),{mode:0o600});
    fs.renameSync(tmp,this.filename);
  }
}
