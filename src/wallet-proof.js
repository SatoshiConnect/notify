import crypto from 'node:crypto';

const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ED25519_SPKI_PREFIX=Buffer.from('302a300506032b6570032100','hex');

function decodeBase32(value){
  let bits=0,buffer=0;const output=[];
  for(const character of value){const digit=BASE32.indexOf(character);if(digit<0)throw new Error('Invalid StrKey');buffer=(buffer<<5)|digit;bits+=5;if(bits>=8){output.push((buffer>>>(bits-8))&255);bits-=8;}}
  if(bits&&(buffer&((1<<bits)-1)))throw new Error('Invalid StrKey');
  return Buffer.from(output);
}
function crc16(bytes){let crc=0;for(const byte of bytes){crc^=byte<<8;for(let bit=0;bit<8;bit++)crc=crc&0x8000?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}return crc;}

export function publicKeyFromWalletAddress(address){
  if(typeof address!=='string')throw new Error('Invalid wallet address');
  const bytes=decodeBase32(address.trim().toUpperCase());
  if(bytes.length!==35||bytes[0]!==48)throw new Error('Invalid wallet address');
  const checksum=crc16(bytes.subarray(0,33));
  if(bytes[33]!== (checksum&255)||bytes[34]!== (checksum>>>8))throw new Error('Invalid wallet checksum');
  return bytes.subarray(1,33);
}

export function verifyWalletMessage(address,message,signature){
  try{
    const publicKey=publicKeyFromWalletAddress(address);
    if(typeof message!=='string'||typeof signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(signature))return false;
    const signatureBytes=Buffer.from(signature,'base64url');
    if(signatureBytes.length!==64||signatureBytes.toString('base64url')!==signature)return false;
    const key=crypto.createPublicKey({key:Buffer.concat([ED25519_SPKI_PREFIX,publicKey]),format:'der',type:'spki'});
    return crypto.verify(null,Buffer.from(message,'utf8'),key,signatureBytes);
  }catch{return false;}
}
