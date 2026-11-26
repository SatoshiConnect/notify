import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {cleanText} from './store.js';

const USERNAME = /^[a-z0-9_]{3,24}$/;
const AVATAR = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const VISIBILITY = new Set(['only_me','friends','everyone']);
const VISIBLE_FIELDS = ['phone','bio','statusMessage','coverPhoto','birthday','website','city','work','education','relationship'];
const VISIBILITY_KEY = field => `${field}Visibility`;
const cleanProfileField = (fields, old, key, max) => fields[key]===undefined?(old[key]||''):cleanText(fields[key],max);

export class ProfileStore {
  constructor(filename) {
    this.filename = filename;
    this.users = new Map();
    try {
      const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
      for (const [id, profile] of Object.entries(saved)) {
        if (profile && typeof profile.username === 'string') this.users.set(id, profile);
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  ensure(user) {
    const current = this.users.get(user.id);
    if (current) return current;
    const base = cleanText(user.name,48).toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,17).replace(/_+$/g,'') || 'member';
    const suffix = crypto.createHash('sha256').update(user.id).digest('hex').slice(0,5);
    const avatarUrl=String(user.avatarUrl||'').startsWith('https://lh3.googleusercontent.com/')?String(user.avatarUrl).slice(0,1000):'';
    const profile = {id:crypto.randomUUID(),username:`${base}_${suffix}`,displayName:cleanText(user.name,48)||'Member',phone:'',phoneVisibility:'only_me',setupComplete:false,walletAddress:'',walletBackupConfirmed:false,bio:'',bioVisibility:'everyone',statusMessage:'',statusMessageVisibility:'everyone',avatar:'',coverPhoto:'',coverPhotoVisibility:'everyone',birthday:'',birthdayVisibility:'only_me',website:'',websiteVisibility:'only_me',city:'',cityVisibility:'only_me',work:'',workVisibility:'only_me',education:'',educationVisibility:'only_me',relationship:'',relationshipVisibility:'only_me',avatarUrl,email:String(user.email||'').toLowerCase(),createdAt:new Date().toISOString()};
    this.users.set(user.id,profile);this.save();return profile;
  }
  get(id) { return this.users.get(id) || null; }
  findByPublicId(profileId) {
    for(const [userId,profile] of this.users)if(profile.id===profileId)return {userId,profile};
    return null;
  }
  update(id, fields, {completeSetup=false}={}) {
    const old=this.get(id);if(!old)throw new Error('Profile not found');
    if(!completeSetup&&(fields.setupComplete!==undefined||fields.walletAddress!==undefined||fields.walletBackupConfirmed!==undefined))throw new Error('Wallet setup fields require verified wallet ownership.');
    if(completeSetup&&old.setupComplete!==false)throw new Error('Wallet setup is already complete.');
    const username=fields.username===undefined?old.username:cleanText(fields.username,24).toLowerCase();
    const displayName=fields.displayName===undefined?old.displayName:cleanText(fields.displayName,48);
    const phone=fields.phone===undefined?(old.phone||''):cleanText(fields.phone,24);
    const walletAddress=completeSetup?String(fields.walletAddress||'').trim().toUpperCase():(old.walletAddress||'');
    const profileFields={
      bio:cleanProfileField(fields,old,'bio',160), statusMessage:cleanProfileField(fields,old,'statusMessage',100),
      birthday:cleanProfileField(fields,old,'birthday',10), website:cleanProfileField(fields,old,'website',200),
      city:cleanProfileField(fields,old,'city',80), work:cleanProfileField(fields,old,'work',100),
      education:cleanProfileField(fields,old,'education',100), relationship:cleanProfileField(fields,old,'relationship',40)
    };
    const avatar=fields.avatar===undefined?old.avatar:fields.avatar;
    const coverPhoto=fields.coverPhoto===undefined?(old.coverPhoto||''):fields.coverPhoto;
    const visibility=Object.fromEntries(VISIBLE_FIELDS.map(field=>{
      const key=VISIBILITY_KEY(field),value=fields[key]===undefined?(old[key]|| (field==='bio'||field==='statusMessage'||field==='coverPhoto'?'everyone':'only_me')):fields[key];
      if(!VISIBILITY.has(value))throw new Error(`Visibility for ${field} must be everyone, friends, or only me.`);
      return [key,value];
    }));
    const birthday=profileFields.birthday;
    if(!USERNAME.test(username))throw new Error('Username must be 3–24 lowercase letters, numbers, or underscores.');
    if(!displayName||displayName.length<2)throw new Error('Display name must be at least 2 characters.');
    if(phone&&!/^\+?[0-9 ()-]{7,24}$/.test(phone))throw new Error('Enter a valid phone number or leave it blank.');
    if(birthday){const parsed=/^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);let valid=false;try{valid=!!parsed&&new Date(`${birthday}T00:00:00.000Z`).toISOString().slice(0,10)===birthday&&birthday<=new Date().toISOString().slice(0,10);}catch{}if(!valid)throw new Error('Enter a valid birthday.');}
    if(profileFields.website){let url;try{url=new URL(profileFields.website);}catch{}if(!url||!['http:','https:'].includes(url.protocol))throw new Error('Website must start with http:// or https://.');}
    if(profileFields.relationship&&!['Single','In a relationship','Married','Other'].includes(profileFields.relationship))throw new Error('Choose a valid relationship status.');
    if(walletAddress&&!/^G[A-Z2-7]{55}$/.test(walletAddress))throw new Error('Wallet address is invalid.');
    if(completeSetup&&(!/^G[A-Z2-7]{55}$/.test(walletAddress)||fields.walletBackupConfirmed!==true))throw new Error('Create a wallet and confirm that you saved its recovery key.');
    for(const [otherId,profile] of this.users){if(otherId!==id&&profile.username===username)throw new Error('That username is already taken.');}
    if(typeof avatar!=='string'||avatar.length>180000||(avatar&&!AVATAR.test(avatar)))throw new Error('Profile photo must be a small JPEG, PNG, or WebP image.');
    if(typeof coverPhoto!=='string'||coverPhoto.length>260000||(coverPhoto&&!AVATAR.test(coverPhoto)))throw new Error('Cover photo must be a small JPEG, PNG, or WebP image.');
    const updated={...old,...profileFields,...visibility,username,displayName,phone,coverPhoto,walletAddress,walletBackupConfirmed:completeSetup?true:old.walletBackupConfirmed===true,bio:profileFields.bio,avatar,setupComplete:completeSetup?true:old.setupComplete!==false};this.users.set(id,updated);this.save();return updated;
  }
  search(query) {
    const value=cleanText(query,254).toLowerCase().replace(/^@/,'');
    if(value.length<3)return [];
    return [...this.users.values()].filter(profile=>profile.setupComplete!==false&&(profile.username.startsWith(value)||profile.email===value)).slice(0,20);
  }
  public(profile,online=false,{isOwner=false,isFriend=false,includeCover=false}={}) {
    if(!profile)return null;
    const {id,username,displayName,avatar,avatarUrl}=profile;
    const result={id,username,displayName,avatar,avatarUrl,online};
    const canSee=field=>isOwner||profile[VISIBILITY_KEY(field)]==='everyone'||(profile[VISIBILITY_KEY(field)]==='friends'&&isFriend);
    for(const field of VISIBLE_FIELDS){if(field==='coverPhoto'&&!includeCover)continue;if(canSee(field)&&profile[field])result[field]=profile[field];}
    if(isOwner)for(const field of VISIBLE_FIELDS)result[VISIBILITY_KEY(field)]=profile[VISIBILITY_KEY(field)]||(field==='bio'||field==='statusMessage'||field==='coverPhoto'?'everyone':'only_me');
    return result;
  }
  save() {
    const dir=path.dirname(this.filename);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;fs.writeFileSync(tmp,JSON.stringify(Object.fromEntries(this.users)),{mode:0o600});fs.renameSync(tmp,this.filename);
  }
}
