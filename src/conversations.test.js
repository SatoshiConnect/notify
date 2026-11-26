import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {ConversationStore} from './conversations.js';

test('direct chats are deterministic, private to members, and persistent',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nsat-chats-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const filename=path.join(directory,'conversations.json');
  const store=new ConversationStore(filename);
  const created=store.direct('google:a','google:b');
  assert.match(created.room,/^dm_[a-f0-9]{40}$/);
  assert.deepEqual(created.members,['google:a','google:b']);
  assert.equal(store.direct('google:b','google:a').room,created.room);
  assert.deepEqual(store.forUser('google:a'),[created]);
  assert.deepEqual(store.forUser('google:c'),[]);
  assert.equal(new ConversationStore(filename).get(created.room).room,created.room);
});

test('direct chat cannot be opened with self or missing identities',()=>{
  const store=new ConversationStore(path.join(os.tmpdir(),'unused-nsat-conversations.json'));
  assert.throws(()=>store.direct('google:a','google:a'),/another user/);
  assert.throws(()=>store.direct('','google:a'),/another user/);
});
