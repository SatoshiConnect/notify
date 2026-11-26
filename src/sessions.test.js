import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SessionStore,deviceLabel} from './sessions.js';

test('sessions persist, are scoped to an account, and can be revoked individually or in bulk',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nsat-sessions-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const filename=path.join(directory,'sessions.json');const sessions=new SessionStore(filename);
  const current=sessions.create('alice','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  const other=sessions.create('alice','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36');
  const anotherUser=sessions.create('bob','Chrome Android',{trusted:true});
  assert.equal(current.device,'Safari on iPhone');
  assert.equal(anotherUser.trusted,true);
  assert.equal(sessions.isActive('alice',current.id),true);
  assert.equal(sessions.isActive('bob',current.id),false);
  assert.equal(new SessionStore(filename).list('alice',current.id).find(item=>item.id===current.id).current,true);
  assert.deepEqual(sessions.revokeOthers('alice',current.id),[other.id]);
  assert.equal(sessions.isActive('alice',other.id),false);
  assert.equal(sessions.revoke('alice',current.id),true);
  assert.equal(sessions.isActive('alice',current.id),false);
});

test('device labels discard raw user-agent detail',()=>{
  assert.equal(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/18.2 Safari/605.1.15'),'Safari on macOS');
  assert.equal(deviceLabel(''),'Unknown browser on Unknown device');
});
