import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {publicKeyFromWalletAddress,verifyWalletMessage} from './wallet-proof.js';
import {signWalletMessage} from '../public/wallet-keys.js';

const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function crc16(bytes){let crc=0;for(const byte of bytes){crc^=byte<<8;for(let bit=0;bit<8;bit++)crc=crc&0x8000?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}return crc;}
function base32Encode(bytes){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=BASE32[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=BASE32[(value<<(5-bits))&31];return out;}
function encodeStrKey(version,payload){const raw=Buffer.concat([Buffer.from([version]),payload]);const checksum=crc16(raw);return base32Encode(Buffer.concat([raw,Buffer.from([checksum&255,checksum>>>8])]));}
const walletAddress=publicKey=>encodeStrKey(48,publicKey);

test('wallet setup signature proves control of the matching StrKey address',async()=>{
  const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
  const address=walletAddress(publicKey.export({format:'der',type:'spki'}).subarray(-32));
  const message='NSAT Messenger wallet setup v1\nAccount: google:test\nNonce: one-time';
  const signature=crypto.sign(null,Buffer.from(message),privateKey).toString('base64url');
  const recoveryKey=encodeStrKey(144,privateKey.export({format:'der',type:'pkcs8'}).subarray(-32));
  const browserSignature=await signWalletMessage(recoveryKey,message);
  assert.equal(publicKeyFromWalletAddress(address).length,32);
  assert.equal(verifyWalletMessage(address,message,signature),true);
  assert.equal(verifyWalletMessage(address,message,browserSignature),true);
  assert.equal(verifyWalletMessage(address,`${message}\nchanged`,signature),false);
  assert.equal(verifyWalletMessage(`${address.slice(0,-1)}A`,message,signature),false);
});
