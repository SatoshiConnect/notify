import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import jwt from 'jsonwebtoken';
import {io} from 'socket.io-client';

async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const {port}=server.address();await new Promise(resolve=>server.close(resolve));return port;}
function startServer(directory,port,secret){return spawn(process.execPath,[path.join(directory,'src/server.js')],{cwd:directory,env:{...process.env,NODE_ENV:'development',DEV_GUEST_LOGIN:'true',GOOGLE_CLIENT_ID:'',JWT_SECRET:secret,PORT:String(port)},stdio:'ignore'});}
async function waitReady(child,port){const deadline=Date.now()+10000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error(`Test server exited with ${child.exitCode}`);try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Test server did not become ready');}
async function get(port,url,token){const response=await fetch(`http://127.0.0.1:${port}${url}`,{headers:{Authorization:`Bearer ${token}`}});return {status:response.status,data:await response.json()};}
async function del(port,url,token){const response=await fetch(`http://127.0.0.1:${port}${url}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});return {status:response.status,data:await response.json()};}
async function post(port,url,token){const response=await fetch(`http://127.0.0.1:${port}${url}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});return {status:response.status,data:await response.json()};}
function connect(port,token){const client=io(`http://127.0.0.1:${port}`,{auth:{token},transports:['websocket'],forceNew:true,timeout:5000});return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{client.close();reject(new Error('Session test socket timed out'));},7000);client.once('connect',()=>{clearTimeout(timer);resolve(client);});client.once('connect_error',error=>{clearTimeout(timer);client.close();reject(error);});});}
function stopping(child){if(child.exitCode!==null||child.signalCode!==null)return Promise.resolve();const exited=once(child,'exit');child.kill('SIGTERM');return exited;}

test('session routes revoke API credentials and realtime sockets on the selected devices',{timeout:30000},async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nsat-session-integration-'));
  const project=process.cwd();fs.cpSync(path.join(project,'src'),path.join(directory,'src'),{recursive:true});fs.cpSync(path.join(project,'public'),path.join(directory,'public'),{recursive:true});fs.symlinkSync(path.join(project,'node_modules'),path.join(directory,'node_modules'),'dir');
  const userId='google:session-integration';const secret=crypto.randomBytes(32).toString('hex');const sessions=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];const now=Date.now();
  fs.mkdirSync(path.join(directory,'.data'),{recursive:true});
  fs.writeFileSync(path.join(directory,'.data/sessions.json'),JSON.stringify({[userId]:sessions.map((id,index)=>({id,device:`Browser ${index+1} on macOS`,trusted:index===0,createdAt:new Date(now-index*1000).toISOString(),expiresAt:new Date(now+7*24*60*60*1000).toISOString()}))}));
  const tokenFor=sid=>jwt.sign({id:userId,name:'Session Tester',email:'',sid},secret,{expiresIn:'7d',issuer:'nsat-messenger',audience:'nsat-messenger'});
  const tokens=sessions.map(tokenFor);const port=await freePort();let server=startServer(directory,port,secret);const clients=[];
  t.after(async()=>{clients.forEach(client=>client.close());await stopping(server).catch(()=>{});fs.rmSync(directory,{recursive:true,force:true});});
  await waitReady(server,port);
  for(const token of tokens)clients.push(await connect(port,token));
  const initial=await get(port,'/api/sessions',tokens[0]);assert.equal(initial.status,200);assert.equal(initial.data.sessions.length,3);assert.equal(initial.data.sessions.find(item=>item.current).id,sessions[0]);
  const secondDisconnected=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Selected device socket was not disconnected')),3000);clients[1].once('disconnect',()=>{clearTimeout(timer);resolve(true);});});
  assert.deepEqual(await del(port,`/api/sessions/${sessions[1]}`,tokens[0]),{status:200,data:{ok:true}});assert.equal(await secondDisconnected,true);assert.equal((await get(port,'/api/me',tokens[1])).status,401);
  const thirdDisconnected=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Other device socket was not disconnected')),3000);clients[2].once('disconnect',()=>{clearTimeout(timer);resolve(true);});});
  assert.deepEqual(await del(port,'/api/sessions/others',tokens[0]),{status:200,data:{ok:true,revoked:1}});assert.equal(await thirdDisconnected,true);assert.equal((await get(port,'/api/me',tokens[2])).status,401);
  assert.equal((await get(port,'/api/sessions',tokens[0])).data.sessions.length,1);
  const currentDisconnected=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Current device socket was not disconnected on sign-out')),3000);clients[0].once('disconnect',()=>{clearTimeout(timer);resolve(true);});});
  assert.deepEqual(await post(port,'/api/auth/logout',tokens[0]),{status:200,data:{ok:true}});assert.equal(await currentDisconnected,true);assert.equal((await get(port,'/api/me',tokens[0])).status,401);
});
