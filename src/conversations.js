import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class ConversationStore {
  constructor(filename) {
    this.filename=filename;
    this.conversations=new Map();
    try {
      const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
      for(const conversation of saved){
        if(conversation?.type==='direct'&&typeof conversation.room==='string'&&Array.isArray(conversation.members)&&conversation.members.length===2)
          this.conversations.set(conversation.room,conversation);
      }
    } catch(error) { if(error.code!=='ENOENT')throw error; }
  }
  direct(userA,userB) {
    if(!userA||!userB||userA===userB)throw new Error('Choose another user to start a chat.');
    const members=[userA,userB].sort();
    const room=`dm_${crypto.createHash('sha256').update(members.join('\0')).digest('hex').slice(0,40)}`;
    const current=this.conversations.get(room);
    if(current)return current;
    const conversation={room,type:'direct',members,createdAt:new Date().toISOString()};
    this.conversations.set(room,conversation);
    this.save();
    return conversation;
  }
  get(room) { return this.conversations.get(room)||null; }
  forUser(userId) {
    return [...this.conversations.values()].filter(item=>item.members.includes(userId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  save() {
    const dir=path.dirname(this.filename);
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;
    fs.writeFileSync(tmp,JSON.stringify([...this.conversations.values()]),{mode:0o600});
    fs.renameSync(tmp,this.filename);
  }
}
