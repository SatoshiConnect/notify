import fs from 'node:fs';
import path from 'node:path';

export class PinStore {
  constructor(filename) {
    this.filename=filename;
    this.users=new Map();
    try {
      const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
      for(const [userId,pins] of Object.entries(saved))this.users.set(userId,{chats:Array.isArray(pins?.chats)?pins.chats.filter(room=>typeof room==='string'):[],messages:Array.isArray(pins?.messages)?pins.messages.filter(item=>typeof item?.room==='string'&&typeof item?.id==='string'):[]});
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  list(userId){const pins=this.users.get(userId)||{chats:[],messages:[]};return {chats:[...pins.chats],messages:pins.messages.map(item=>({...item}))};}
  setChat(userId,room,pinned){
    const pins=this.list(userId);pins.chats=pinned?[room,...pins.chats.filter(item=>item!==room)]:pins.chats.filter(item=>item!==room);
    this.users.set(userId,pins);this.save();return this.list(userId);
  }
  setMessage(userId,room,id,pinned){
    const pins=this.list(userId);pins.messages=pinned?[{room,id},...pins.messages.filter(item=>item.room!==room||item.id!==id)]:pins.messages.filter(item=>item.room!==room||item.id!==id);
    this.users.set(userId,pins);this.save();return this.list(userId);
  }
  save(){
    const directory=path.dirname(this.filename);fs.mkdirSync(directory,{recursive:true,mode:0o700});
    const temporary=`${this.filename}.tmp`;fs.writeFileSync(temporary,JSON.stringify(Object.fromEntries(this.users)),{mode:0o600});fs.renameSync(temporary,this.filename);
  }
}
