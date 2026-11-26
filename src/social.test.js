import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SocialStore} from './social.js';

test('friend requests can be accepted and persist for both users',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nsat-social-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const filename=path.join(directory,'social.json');
  const social=new SocialStore(filename);
  const sent=social.request('user:a','user:b');
  assert.equal(sent.status,'pending');
  assert.equal(social.relationship('user:b','user:a').incoming,sent.request.id);
  assert.throws(()=>social.respond('user:a',sent.request.id,'accept'),/not found/);
  social.respond('user:b',sent.request.id,'accept');
  assert.deepEqual(social.friendsFor('user:a'),['user:b']);
  assert.deepEqual(new SocialStore(filename).friendsFor('user:b'),['user:a']);
});

test('blocking removes friendship and pending requests and prevents new requests',()=>{
  const social=new SocialStore(path.join(os.tmpdir(),'unused-social.json'));
  const request=social.request('user:a','user:b').request;
  social.respond('user:b',request.id,'accept');
  assert.equal(social.block('user:a','user:b'),true);
  assert.equal(social.isFriend('user:a','user:b'),false);
  assert.equal(social.isBlockedBetween('user:b','user:a'),true);
  assert.equal(social.relationship('user:b','user:a').blockedByThem,true);
  assert.throws(()=>social.request('user:b','user:a'),/blocked/);
  assert.equal(social.unblock('user:a','user:b'),true);
  assert.equal(social.isBlockedBetween('user:a','user:b'),false);
});

test('reports store a bounded category and details for moderation',()=>{
  const social=new SocialStore(path.join(os.tmpdir(),'unused-reports.json'));
  const report=social.report('user:a','user:b','spam','Repeated unsolicited messages');
  assert.equal(report.status,'open');
  assert.equal(report.details,'Repeated unsolicited messages');
  assert.throws(()=>social.report('user:a','user:b','unknown',''),/category/);
});
