import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {ProfileStore} from './profiles.js';

function temporaryStore(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nsat-profiles-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  return new ProfileStore(path.join(directory,'profiles.json'));
}

test('profiles persist and public profile omits email',t=>{
  const store=temporaryStore(t);
  const profile=store.ensure({id:'google:1',name:'Migs Sa-Nga',email:'MIGS@example.com'});
  const restored=new ProfileStore(store.filename).get('google:1');
  assert.equal(restored.username,profile.username);
  assert.equal(restored.email,'migs@example.com');
  assert.equal('email' in store.public(restored),false);
  assert.match(restored.username,/^migs_sa_nga_[a-f0-9]{5}$/);
});

test('profiles update fields and reject invalid or duplicate usernames',t=>{
  const store=temporaryStore(t);
  store.ensure({id:'user:1',name:'First'});
  store.ensure({id:'user:2',name:'Second'});
  const first=store.update('user:1',{username:'First_User',displayName:'First Person',bio:'Hello'});
  assert.equal(first.username,'first_user');
  assert.equal(first.displayName,'First Person');
  assert.equal(first.bio,'Hello');
  assert.throws(()=>store.update('user:2',{username:'FIRST_USER'}),/already taken/);
  assert.throws(()=>store.update('user:2',{username:'ab'}),/3–24/);
  assert.throws(()=>store.update('user:2',{displayName:'x'}),/at least 2/);
});

test('user search supports username prefixes and exact email',t=>{
  const store=temporaryStore(t);
  const one=store.ensure({id:'user:1',name:'Migs One',email:'one@example.com'});
  store.update('user:1',{walletAddress:`G${'A'.repeat(55)}`,walletBackupConfirmed:true},{completeSetup:true});
  store.ensure({id:'user:2',name:'Milo Two',email:'two@example.com'});
  store.update('user:2',{walletAddress:`G${'B'.repeat(55)}`,walletBackupConfirmed:true},{completeSetup:true});
  assert.deepEqual(store.search(one.username.slice(0,4)).map(user=>user.id),[one.id]);
  assert.deepEqual(store.search('one@example.com').map(user=>user.id),[one.id]);
  assert.deepEqual(store.search('one@exam'),[]);
  assert.deepEqual(store.search('mi'),[]);
});

test('wallet identity cannot be set or onboarding completed through ordinary profile updates',t=>{
  const store=temporaryStore(t);store.ensure({id:'user:1',name:'Member'});
  assert.throws(()=>store.update('user:1',{walletAddress:`G${'A'.repeat(55)}`,walletBackupConfirmed:true,setupComplete:true}),/verified wallet ownership/);
  assert.equal(store.get('user:1').setupComplete,false);
  assert.equal(store.get('user:1').walletAddress,'');
});
