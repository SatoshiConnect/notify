import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PinStore} from './pins.js';

test('chat and message pins are isolated by account and persist',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nsat-pins-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const filename=path.join(directory,'pins.json');
  const pins=new PinStore(filename);
  pins.setChat('alice','lobby',true);
  pins.setMessage('alice','lobby','message-1',true);
  pins.setChat('bob','lobby',true);
  const restored=new PinStore(filename);
  assert.deepEqual(restored.list('alice'),{chats:['lobby'],messages:[{room:'lobby',id:'message-1'}]});
  assert.deepEqual(restored.list('bob'),{chats:['lobby'],messages:[]});
  restored.setMessage('alice','lobby','message-1',false);
  restored.setChat('alice','lobby',false);
  assert.deepEqual(new PinStore(filename).list('alice'),{chats:[],messages:[]});
});
