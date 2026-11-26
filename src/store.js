import fs from 'node:fs';
import path from 'node:path';

const MAX_MESSAGES = 100;
export function cleanText(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}
export function validRoomId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,48}$/.test(value);
}
export class MessageStore {
  constructor(filename) {
    this.filename = filename;
    this.rooms = new Map();
    try {
      const db = JSON.parse(fs.readFileSync(filename, 'utf8'));
      for (const [name, history] of Object.entries(db)) {
        if (validRoomId(name) && Array.isArray(history)) this.rooms.set(name, history.slice(-MAX_MESSAGES));
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  get(room) { return this.rooms.get(room) ?? []; }
  add(room, message) {
    const history = this.get(room).slice(-MAX_MESSAGES + 1);
    history.push(message);
    this.rooms.set(room, history);
    const dir = path.dirname(this.filename);
    fs.mkdirSync(dir, {recursive: true, mode: 0o700});
    const tmp = `${this.filename}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.rooms)), {mode: 0o600});
    fs.renameSync(tmp, this.filename);
    return message;
  }
  update(room, id, updater) {
    const history = this.get(room).slice();
    const index = history.findIndex(message => message.id === id);
    if (index < 0) return null;
    history[index] = updater({...history[index]});
    this.rooms.set(room, history);
    const dir = path.dirname(this.filename);
    fs.mkdirSync(dir, {recursive: true, mode: 0o700});
    const tmp = `${this.filename}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.rooms)), {mode: 0o600});
    fs.renameSync(tmp, this.filename);
    return history[index];
  }
  updateMany(room, ids, updater) {
    const wanted=new Set(ids);
    const history=this.get(room).slice();
    const changed=[];
    for(let index=0;index<history.length;index++){
      if(!wanted.has(history[index].id))continue;
      const next=updater({...history[index]});
      if(!next)continue;
      history[index]=next;changed.push(next);
    }
    if(!changed.length)return [];
    this.rooms.set(room,history);
    const dir=path.dirname(this.filename);
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;
    fs.writeFileSync(tmp,JSON.stringify(Object.fromEntries(this.rooms)),{mode:0o600});
    fs.renameSync(tmp,this.filename);
    return changed;
  }
}
