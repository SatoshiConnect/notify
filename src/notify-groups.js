import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class NotifyGroupStore {
  constructor(filename) {
    this.filename=filename;this.groups=new Map();
    try {
      const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
      for(const item of saved)if(item?.id&&item.ownerId&&Array.isArray(item.members))this.groups.set(item.id,{...item,members:[...new Set(item.members.filter(id=>typeof id==='string'))]});
    } catch(error) { if(error.code!=='ENOENT')throw error; }
  }
  list(ownerId) { return [...this.groups.values()].filter(group=>group.ownerId===ownerId).sort((a,b)=>a.name.localeCompare(b.name)).map(group=>({...group,members:[...group.members]})); }
  get(ownerId,id) { const group=this.groups.get(id);return group?.ownerId===ownerId?{...group,members:[...group.members]}:null; }
  create(ownerId,name,members) {
    const now=new Date().toISOString();const group={id:crypto.randomUUID(),ownerId,name,members:[...new Set(members)],createdAt:now,updatedAt:now};
    this.groups.set(group.id,group);this.save();return {...group,members:[...group.members]};
  }
  update(ownerId,id,name,members) {
    const current=this.groups.get(id);if(!current||current.ownerId!==ownerId)return null;
    const group={...current,name,members:[...new Set(members)],updatedAt:new Date().toISOString()};this.groups.set(id,group);this.save();return {...group,members:[...group.members]};
  }
  delete(ownerId,id) { const current=this.groups.get(id);if(!current||current.ownerId!==ownerId)return false;this.groups.delete(id);this.save();return true; }
  save() {
    const dir=path.dirname(this.filename);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;fs.writeFileSync(tmp,JSON.stringify([...this.groups.values()]),{mode:0o600});fs.renameSync(tmp,this.filename);
  }
}
