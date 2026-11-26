import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_PER_USER = 200;

export class NotificationStore {
  constructor(filename, imageDirectory) {
    this.filename=filename;this.imageDirectory=imageDirectory;this.byUser=new Map();
    try {
      const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
      for(const [userId,items] of Object.entries(saved))this.byUser.set(userId,(Array.isArray(items)?items:[]).filter(item=>item?.id&&item.createdAt).slice(0,MAX_PER_USER));
    } catch(error) { if(error.code!=='ENOENT')throw error; }
  }
  create(userId, fields) {
    return this.createMany([userId],fields)[0].notification;
  }
  createMany(userIds,fields) {
    fs.mkdirSync(this.imageDirectory,{recursive:true,mode:0o700});
    const created=[],discarded=[];
    if(fields.imageBytes&&fields.image)fs.writeFileSync(path.join(this.imageDirectory,`${fields.image.id}.${fields.image.ext}`),fields.imageBytes,{mode:0o600,flag:'wx'});
    for(const userId of userIds){
      const item={id:crypto.randomUUID(),title:fields.title,body:fields.body,occurredAt:fields.occurredAt,source:fields.source||'',image:fields.image||null,createdAt:new Date().toISOString(),readAt:null};
      const previous=this.byUser.get(userId)||[];const items=[item,...previous].slice(0,MAX_PER_USER);
      if(previous.length>=MAX_PER_USER)discarded.push(...previous.slice(MAX_PER_USER-1));
      this.byUser.set(userId,items);created.push({userId,notification:{...item}});
    }
    this.save();
    const referencedImages=new Set([...this.byUser.values()].flat().map(item=>item.image?.id).filter(Boolean));
    for(const id of new Set(discarded.map(item=>item.image?.id).filter(Boolean)))if(!referencedImages.has(id)){
      const ext=discarded.find(item=>item.image?.id===id)?.image?.ext;
      if(ext)try{fs.unlinkSync(path.join(this.imageDirectory,`${id}.${ext}`));}catch{}
    }
    return created;
  }
  list(userId, {unread=false,limit=50}={}) {
    const items=this.byUser.get(userId)||[];
    return items.filter(item=>!unread||!item.readAt).slice(0,limit).map(item=>({...item}));
  }
  unreadCount(userId) { return (this.byUser.get(userId)||[]).filter(item=>!item.readAt).length; }
  markRead(userId,id) {
    const items=this.byUser.get(userId)||[];const item=items.find(entry=>entry.id===id);if(!item)return null;
    if(!item.readAt){item.readAt=new Date().toISOString();this.save();}
    return {...item};
  }
  markAllRead(userId) {
    const items=this.byUser.get(userId)||[];let updated=0;const readAt=new Date().toISOString();
    for(const item of items)if(!item.readAt){item.readAt=readAt;updated++;}
    if(updated)this.save();return updated;
  }
  get(userId,id) { const item=(this.byUser.get(userId)||[]).find(entry=>entry.id===id);return item?{...item}:null; }
  save() {
    const dir=path.dirname(this.filename);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    fs.mkdirSync(this.imageDirectory,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;fs.writeFileSync(tmp,JSON.stringify(Object.fromEntries(this.byUser)),{mode:0o600});fs.renameSync(tmp,this.filename);
  }
}

export class PushSubscriptionStore {
  constructor(filename) {
    this.filename=filename;this.subscriptions=new Map();
    try {
      const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
      for(const item of saved)if(item?.endpoint&&item?.userId&&item?.keys?.p256dh&&item?.keys?.auth)this.subscriptions.set(item.endpoint,item);
    } catch(error) { if(error.code!=='ENOENT')throw error; }
  }
  set(userId,subscription) {
    const value={userId,endpoint:subscription.endpoint,keys:{p256dh:subscription.keys.p256dh,auth:subscription.keys.auth},updatedAt:new Date().toISOString()};
    this.subscriptions.set(value.endpoint,value);this.save();return {...value};
  }
  remove(userId,endpoint) { const item=this.subscriptions.get(endpoint);if(!item||item.userId!==userId)return false;this.subscriptions.delete(endpoint);this.save();return true; }
  forUser(userId) { return [...this.subscriptions.values()].filter(item=>item.userId===userId).map(item=>({...item,keys:{...item.keys}})); }
  removeEndpoint(endpoint) { if(!this.subscriptions.delete(endpoint))return false;this.save();return true; }
  save() {
    const dir=path.dirname(this.filename);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;fs.writeFileSync(tmp,JSON.stringify([...this.subscriptions.values()]),{mode:0o600});fs.renameSync(tmp,this.filename);
  }
}
