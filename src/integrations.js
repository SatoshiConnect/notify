import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class IntegrationKeyStore {
  constructor(filename) {
    this.filename = filename;
    this.keys = new Map();
    try {
      const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
      for (const item of saved) if (item?.id && item?.userId && item?.hash) this.keys.set(item.id, item);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  create(userId, label = 'Integration', provider = 'legacy') {
    const token = `nsat_${crypto.randomBytes(32).toString('base64url')}`;
    const item = {id: crypto.randomUUID(), userId: String(userId), provider, label: String(label).trim().slice(0, 60) || 'Integration', hash: this.hash(token), createdAt: new Date().toISOString()};
    this.keys.set(item.id, item); this.save();
    return {id: item.id, label: item.label, createdAt: item.createdAt, token};
  }
  static hash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
  authenticate(token) {
    if (typeof token !== 'string' || !/^nsat_[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
    const hash = IntegrationKeyStore.hash(token);
    for (const item of this.keys.values()) {
      const stored = Buffer.from(item.hash, 'hex'), supplied = Buffer.from(hash, 'hex');
      if (stored.length === supplied.length && crypto.timingSafeEqual(stored, supplied)) return {...item};
    }
    return null;
  }
  list(userId) { return [...this.keys.values()].filter(item => item.userId === String(userId)).map(({id,label,createdAt}) => ({id,label,createdAt})); }
  revoke(userId, id) { const item=this.keys.get(id); if(!item||item.userId!==String(userId))return false; this.keys.delete(id);this.save();return true; }
  save() {
    const dir=path.dirname(this.filename);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;fs.writeFileSync(tmp,JSON.stringify([...this.keys.values()]),{mode:0o600});fs.renameSync(tmp,this.filename);
  }
}
