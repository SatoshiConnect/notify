import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ReferralStore} from './referrals.js';

test('referrals credit both members once after onboarding and persist the ledger',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nsat-referrals-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const filename=path.join(directory,'referrals.json'),store=new ReferralStore(filename,{reward:75});
  const code=store.codeFor('inviter');
  assert.match(code,/^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(store.register('invitee',code.toLowerCase()),true);
  assert.equal(store.register('invitee',code),false);
  assert.equal(store.register('inviter',code),false);
  assert.equal(store.register('other','INVALID!'),false);
  assert.equal(store.summary('inviter').balance,0);
  assert.equal(store.summary('inviter').completedCount,0);
  assert.equal(store.complete('invitee'),true);
  assert.equal(store.complete('invitee'),false);
  assert.equal(store.summary('inviter').balance,75);
  assert.equal(store.summary('invitee').balance,75);
  const restored=new ReferralStore(filename,{reward:75});
  assert.equal(restored.complete('invitee'),false);
  assert.equal(restored.summary('inviter').balance,75);
  assert.equal(restored.summary('inviter').completedCount,1);
  assert.equal(JSON.parse(fs.readFileSync(filename,'utf8')).ledger.length,2);
});
