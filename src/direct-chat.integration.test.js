import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {io} from 'socket.io-client';

const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function crc16(bytes){let crc=0;for(const byte of bytes){crc^=byte<<8;for(let bit=0;bit<8;bit++)crc=crc&0x8000?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}return crc;}
function base32Encode(bytes){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=BASE32[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=BASE32[(value<<(5-bits))&31];return out;}
function encodeWalletAddress(publicKey){const raw=Buffer.concat([Buffer.from([48]),publicKey]);const checksum=crc16(raw);return base32Encode(Buffer.concat([raw,Buffer.from([checksum&255,checksum>>>8])]));}

async function freePort() {
  const server=net.createServer();
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const {port}=server.address();
  await new Promise(resolve=>server.close(resolve));
  return port;
}
function startServer(directory,port,secret) {
  return spawn(process.execPath,[path.join(directory,'src/server.js')],{
    cwd:directory,
    env:{...process.env,NODE_ENV:'development',DEV_GUEST_LOGIN:'true',GOOGLE_CLIENT_ID:'',JWT_SECRET:secret,PORT:String(port)},
    stdio:'ignore'
  });
}
async function waitReady(child,port) {
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Test server exited with code ${child.exitCode}`);
    try{const response=await fetch(`http://127.0.0.1:${port}/health`);if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('Test server did not become ready');
}
async function post(port,pathName,body,token) {
  const response=await fetch(`http://127.0.0.1:${port}${pathName}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw new Error(`${pathName}: ${data.error||response.status}`);
  return data;
}
async function completeSetup(port,token){
  const {walletAddress,privateKey}=generateWallet();
  const challenge=await post(port,'/api/me/wallet-challenge',{walletAddress},token);
  const signature=crypto.sign(null,Buffer.from(challenge.message),privateKey).toString('base64url');
  return post(port,'/api/me/complete-setup',{walletAddress,walletBackupConfirmed:true,signature},token);
}
function generateWallet(){const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');return {walletAddress:encodeWalletAddress(publicKey.export({format:'der',type:'spki'}).subarray(-32)),privateKey};}
async function request(port,pathName,body,token) {
  const response=await fetch(`http://127.0.0.1:${port}${pathName}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
}
async function put(port,pathName,body,token) {
  const response=await fetch(`http://127.0.0.1:${port}${pathName}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
}
function connectClient(port,token) {
  const client=io(`http://127.0.0.1:${port}`,{auth:{token},transports:['websocket'],forceNew:true,timeout:5000});
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{client.close();reject(new Error('Socket connection timed out'));},7000);
    client.once('connect',()=>{clearTimeout(timer);resolve(client);});
    client.once('connect_error',error=>{clearTimeout(timer);client.close();reject(error);});
  });
}
function join(client,room) {
  return new Promise(resolve=>client.emit('join-room',room,resolve));
}
function stop(child) {
  if(child.exitCode!==null||child.signalCode!==null)return Promise.resolve();
  const exited=once(child,'exit');
  child.kill('SIGTERM');
  return exited;
}

test('direct chats enforce membership and persist across server restarts',{timeout:30000},async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nsat-direct-integration-'));
  const project=process.cwd();
  fs.cpSync(path.join(project,'src'),path.join(directory,'src'),{recursive:true});
  fs.cpSync(path.join(project,'public'),path.join(directory,'public'),{recursive:true});
  fs.symlinkSync(path.join(project,'node_modules'),path.join(directory,'node_modules'),'dir');
  const port=await freePort();
  const secret=crypto.randomBytes(32).toString('hex');
  let server=startServer(directory,port,secret);
  let clients=[];
  t.after(async()=>{
    for(const client of clients)client.close();
    await stop(server).catch(()=>{});
    fs.rmSync(directory,{recursive:true,force:true});
  });
  await waitReady(server,port);
  const alice=await post(port,'/api/auth/demo',{name:'Alice',rememberDevice:true});
  const bob=await post(port,'/api/auth/demo',{name:'Bob'});
  const outsider=await post(port,'/api/auth/demo',{name:'Casey'});
  const forgedWallet=generateWallet();
  const challenge=await post(port,'/api/me/wallet-challenge',{walletAddress:forgedWallet.walletAddress},outsider.token);
  const forged=await fetch(`http://127.0.0.1:${port}/api/me/complete-setup`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${outsider.token}`},body:JSON.stringify({walletAddress:forgedWallet.walletAddress,walletBackupConfirmed:true,signature:'A'.repeat(86)})});
  assert.equal(forged.status,400);
  const bypass=await fetch(`http://127.0.0.1:${port}/api/me`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${outsider.token}`},body:JSON.stringify({setupComplete:true,walletAddress:forgedWallet.walletAddress,walletBackupConfirmed:true})});
  assert.equal(bypass.status,400);
  assert.equal((await request(port,'/api/me',undefined,outsider.token)).data.profile.setupComplete,false);
  await Promise.all([completeSetup(port,alice.token),completeSetup(port,bob.token),completeSetup(port,outsider.token)]);
  assert.equal(alice.rememberDevice,true);
  const aliceClaims=jwt.decode(alice.token);
  assert.ok(aliceClaims.exp-aliceClaims.iat>=29*24*60*60);
  const aliceSessions=await request(port,'/api/sessions',undefined,alice.token);
  assert.equal(aliceSessions.data.sessions.length,1);
  assert.equal(aliceSessions.data.sessions[0].id,aliceClaims.sid);
  assert.equal(aliceSessions.data.sessions[0].current,true);
  const found=await post(port,'/api/users/search',{query:bob.user.username},alice.token);
  assert.equal(found.users.length,1);
  assert.equal('email' in found.users[0],false);
  const friendRequest=await post(port,'/api/friends/request',{profileId:found.users[0].id},alice.token);
  assert.equal(friendRequest.status,'pending');
  const bobFriends=await request(port,'/api/friends',undefined,bob.token);
  assert.equal(bobFriends.data.incoming[0].user.displayName,'Alice');
  const pendingId=bobFriends.data.incoming[0].id;
  const wrongResponder=await post(port,'/api/friends/respond',{requestId:pendingId,action:'accept'},outsider.token).catch(error=>error);
  assert.match(wrongResponder.message,/not found/);
  assert.equal((await post(port,'/api/friends/respond',{requestId:pendingId,action:'accept'},bob.token)).status,'accepted');
  assert.equal((await request(port,'/api/friends',undefined,alice.token)).data.friends[0].username,bob.user.username);
  const report=await fetch(`http://127.0.0.1:${port}/api/reports`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${alice.token}`},body:JSON.stringify({profileId:found.users[0].id,category:'spam',details:'Integration report'})});
  assert.equal(report.status,201);
  assert.equal((await report.json()).ok,true);
  const {chat}=await post(port,'/api/chats/direct',{profileId:found.users[0].id},alice.token);
  assert.match(chat.room,/^dm_[a-f0-9]{40}$/);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/chats`,{headers:{Authorization:`Bearer ${bob.token}`}}).then(r=>r.json())).chats[0].room,chat.room);

  const a=await connectClient(port,alice.token);
  const b=await connectClient(port,bob.token);
  const b2=await connectClient(port,bob.token);
  const c=await connectClient(port,outsider.token);
  clients.push(a,b,b2,c);
  assert.deepEqual(await join(a,chat.room),{ok:true});
  assert.deepEqual(await join(b,chat.room),{ok:true});
  assert.deepEqual(await join(b2,chat.room),{ok:true});
  const currentParticipants=await new Promise(resolve=>b.emit('get-participants',resolve));
  assert.equal(currentParticipants.participants.length,2);
  assert.equal(currentParticipants.participants.some(peer=>peer.user.id===aliceClaims.id),true);
  assert.match((await join(c,chat.room)).error,/not a member/);
  const typing=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Typing status was not broadcast')),3000);
    b.once('typing',event=>{clearTimeout(timer);resolve(event);});
  });
  a.emit('typing',true);
  assert.equal((await typing).typing,true);
  const delivered=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Direct message was not delivered')),3000);
    b.once('message',message=>{clearTimeout(timer);resolve(message);});
  });
  const acknowledged=new Promise(resolve=>a.emit('message',{body:'private test message'},resolve));
  assert.deepEqual(await acknowledged,{ok:true});
  const privateMessage=await delivered;
  assert.equal(privateMessage.body,'private test message');
  await new Promise(resolve=>setTimeout(resolve,400));
  const fileDelivered=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('File attachment was not delivered')),3000);b.once('message',message=>{clearTimeout(timer);resolve(message);});});
  const fileAck=new Promise(resolve=>a.emit('message',{kind:'file',body:'',attachment:{name:'quarterly.pdf',type:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQ='}},resolve));
  assert.deepEqual(await fileAck,{ok:true});
  const fileMessage=await fileDelivered;
  assert.equal(fileMessage.kind,'file');
  assert.equal(fileMessage.attachment.name,'quarterly.pdf');
  await new Promise(resolve=>setTimeout(resolve,400));
  const rejectedFile=new Promise(resolve=>a.emit('message',{kind:'file',body:'',attachment:{name:'unsafe.html',type:'text/html',data:'data:text/html;base64,PGh0bWw+'}},resolve));
  assert.match((await rejectedFile).error,/message/i);
  assert.equal((await put(port,'/api/pins/chat',{room:chat.room,pinned:true},alice.token)).status,200);
  assert.equal((await put(port,'/api/pins/message',{room:chat.room,id:privateMessage.id,pinned:true},alice.token)).status,200);
  assert.equal((await put(port,'/api/pins/message',{room:chat.room,id:privateMessage.id,pinned:true},outsider.token)).status,404);
  const aliceSearch=await post(port,'/api/messages/search',{query:'private test'},alice.token);
  assert.equal(aliceSearch.results[0].room,chat.room);
  assert.equal(aliceSearch.results[0].title,'Bob');
  const outsiderSearch=await post(port,'/api/messages/search',{query:'private test'},outsider.token);
  assert.deepEqual(outsiderSearch.results,[]);
  const readReceipt=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Read receipt was not broadcast')),3000);
    a.once('message-updated',message=>{clearTimeout(timer);resolve(message);});
  });
  const readAck=new Promise(resolve=>b.emit('messages-read',[privateMessage.id],resolve));
  assert.deepEqual(await readAck,{ok:true,updated:1});
  assert.equal((await readReceipt).readBy.length,1);
  await new Promise(resolve=>setTimeout(resolve,400));
  const sameUserSession=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Message did not sync to the second signed-in session')),3000);
    b2.once('message',message=>{clearTimeout(timer);resolve(message);});
  });
  const secondAck=new Promise(resolve=>a.emit('message',{body:'sync test'},resolve));
  assert.deepEqual(await secondAck,{ok:true});
  const syncedMessage=await sameUserSession;
  assert.equal(syncedMessage.body,'sync test');

  a.close();b.close();b2.close();c.close();clients=[];
  await stop(server);
  server=startServer(directory,port,secret);
  await waitReady(server,port);
  const afterRestart=await connectClient(port,bob.token);
  const aliceAfterRestart=await connectClient(port,alice.token);
  clients.push(afterRestart,aliceAfterRestart);
  const history=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Direct message history was not restored')),3000);
    afterRestart.once('history',items=>{clearTimeout(timer);resolve(items);});
  });
  assert.deepEqual(await join(afterRestart,chat.room),{ok:true});
  assert.equal((await history).some(message=>message.body==='private test message'),true);
  const restoredPins=await request(port,'/api/pins',undefined,alice.token);
  assert.deepEqual(restoredPins.data.chats,[chat.room]);
  assert.equal(restoredPins.data.messages[0].room,chat.room);
  assert.equal(restoredPins.data.messages[0].id,privateMessage.id);
  assert.equal(restoredPins.data.messages[0].preview,'private test message');
  assert.deepEqual(await join(aliceAfterRestart,chat.room),{ok:true});
  const deniedDelete=await new Promise(resolve=>afterRestart.emit('message-delete',{id:privateMessage.id},resolve));
  assert.match(deniedDelete.error,/own active messages/);
  const deletedDelivery=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Message deletion was not broadcast to the other device')),3000);
    afterRestart.once('message-updated',message=>{clearTimeout(timer);resolve(message);});
  });
  const deleteAck=new Promise(resolve=>aliceAfterRestart.emit('message-delete',{id:privateMessage.id},resolve));
  assert.deepEqual(await deleteAck,{ok:true});
  const tombstone=await deletedDelivery;
  assert.equal(tombstone.kind,'deleted');
  assert.equal(tombstone.body,'');
  assert.equal('audio' in tombstone,false);
  assert.equal('image' in tombstone,false);
  const deletedSearch=await post(port,'/api/messages/search',{query:'private test'},alice.token);
  assert.deepEqual(deletedSearch.results,[]);
  const deletedPin=await request(port,'/api/pins',undefined,alice.token);
  assert.equal(deletedPin.data.messages.find(item=>item.id===privateMessage.id).preview,'Message deleted');
  const duplicateDelete=await new Promise(resolve=>aliceAfterRestart.emit('message-delete',{id:privateMessage.id},resolve));
  assert.match(duplicateDelete.error,/own active messages/);

  const aliceBlocked=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Block did not close Alice’s active chat')),3000);
    aliceAfterRestart.once('chat-blocked',event=>{clearTimeout(timer);resolve(event);});
  });
  const bobBlocked=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Block did not close Bob’s active chat')),3000);
    afterRestart.once('chat-blocked',event=>{clearTimeout(timer);resolve(event);});
  });
  assert.deepEqual(await post(port,'/api/users/block',{profileId:found.users[0].id},alice.token),{ok:true});
  assert.equal((await aliceBlocked).room,chat.room);
  assert.equal((await bobBlocked).room,chat.room);
  assert.match((await join(afterRestart,chat.room)).error,/not a member/);
  assert.equal((await request(port,'/api/chats',undefined,alice.token)).data.chats.length,0);
  assert.equal((await request(port,'/api/chats',undefined,bob.token)).data.chats.length,0);
  assert.deepEqual((await request(port,'/api/pins',undefined,alice.token)).data,{chats:[],messages:[]});
  const blockedDirect=await fetch(`http://127.0.0.1:${port}/api/chats/direct`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${alice.token}`},body:JSON.stringify({profileId:found.users[0].id})});
  assert.equal(blockedDirect.status,403);
  assert.deepEqual(await join(aliceAfterRestart,'lobby'),{ok:true});
  assert.deepEqual(await join(afterRestart,'lobby'),{ok:true});
  const blockedSignal=new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(false),200);
    afterRestart.once('webrtc',()=>{clearTimeout(timer);resolve(true);});
  });
  aliceAfterRestart.emit('webrtc',{to:afterRestart.id,type:'offer',data:{type:'offer',sdp:'blocked'}});
  assert.equal(await blockedSignal,false);
  assert.deepEqual(await post(port,'/api/users/unblock',{profileId:found.users[0].id},alice.token),{ok:true,changed:true});
  assert.equal((await request(port,'/api/chats',undefined,alice.token)).data.chats[0].room,chat.room);
  assert.equal((await request(port,'/api/pins',undefined,alice.token)).data.messages[0].id,privateMessage.id);
  assert.deepEqual(await join(aliceAfterRestart,chat.room),{ok:true});
  assert.deepEqual(await join(afterRestart,chat.room),{ok:true});
  const allowedSignal=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Unblocked WebRTC signaling was not delivered')),2000);
    afterRestart.once('webrtc',event=>{clearTimeout(timer);resolve(event);});
  });
  aliceAfterRestart.emit('webrtc',{to:afterRestart.id,type:'offer',data:{type:'offer',sdp:'unblocked'},mode:'audio'});
  const relayedOffer=await allowedSignal;
  assert.equal(relayedOffer.data.sdp,'unblocked');
  assert.equal(relayedOffer.mode,'audio');
  assert.deepEqual(await fetch(`http://127.0.0.1:${port}/api/sessions/others`,{method:'DELETE',headers:{Authorization:`Bearer ${alice.token}`}}).then(async response=>({status:response.status,data:await response.json()})),{status:200,data:{ok:true,revoked:0}});
  const sessionDisconnected=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Signing out did not disconnect this device')),3000);
    aliceAfterRestart.once('disconnect',()=>{clearTimeout(timer);resolve(true);});
  });
  assert.deepEqual(await post(port,'/api/auth/logout',{},alice.token),{ok:true});
  assert.equal(await sessionDisconnected,true);
  assert.equal((await request(port,'/api/me',undefined,alice.token)).status,401);
});
