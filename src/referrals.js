import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode=()=>Array.from(crypto.randomBytes(8),byte=>CODE_CHARS[byte%CODE_CHARS.length]).join('');

export class ReferralStore {
  constructor(filename,{reward=100}={}){
    this.filename=filename;this.reward=Number.isSafeInteger(reward)&&reward>0?reward:100;
    this.codes=new Map();this.referrals=new Map();this.ledger=[];
    try{
      const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
      for(const [userId,code] of Object.entries(saved.codes||{}))if(typeof code==='string')this.codes.set(userId,code);
      for(const [inviteeId,item] of Object.entries(saved.referrals||{}))if(item?.referrerId)this.referrals.set(inviteeId,item);
      this.ledger=Array.isArray(saved.ledger)?saved.ledger.filter(item=>item?.id&&item.userId&&Number.isSafeInteger(item.amount)):[];
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  codeFor(userId){
    if(this.codes.has(userId))return this.codes.get(userId);
    const used=new Set(this.codes.values());let code;
    do{code=makeCode();}while(used.has(code));
    this.codes.set(userId,code);this.save();return code;
  }
  register(inviteeId,code){
    if(!inviteeId||this.referrals.has(inviteeId)||typeof code!=='string')return false;
    const normalized=code.trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{8}$/.test(normalized))return false;
    const referrerId=[...this.codes].find(([,value])=>value===normalized)?.[0];
    if(!referrerId||referrerId===inviteeId)return false;
    this.referrals.set(inviteeId,{referrerId,status:'pending',createdAt:new Date().toISOString(),completedAt:null});this.save();return true;
  }
  complete(inviteeId){
    const referral=this.referrals.get(inviteeId);if(!referral||referral.status==='credited')return false;
    const now=new Date().toISOString();
    for(const [userId,role] of [[referral.referrerId,'inviter'],[inviteeId,'invitee']]){
      const id=`referral:${inviteeId}:${role}`;
      if(!this.ledger.some(item=>item.id===id))this.ledger.push({id,userId,amount:this.reward,currency:'NSAT credit',kind:'referral_reward',referralUserId:inviteeId,role,createdAt:now});
    }
    referral.status='credited';referral.completedAt=now;this.save();return true;
  }
  summary(userId){
    const invited=[...this.referrals].filter(([,item])=>item.referrerId===userId);
    const rewards=this.ledger.filter(item=>item.userId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return {code:this.codeFor(userId),balance:rewards.reduce((sum,item)=>sum+item.amount,0),invitedCount:invited.length,completedCount:invited.filter(([,item])=>item.status==='credited').length,rewardPerPerson:this.reward,exchangeRate:1,currency:'NSAT credit',redemption:'Credits stay in the app until NSAT Mainnet redemption is added.',rewards:rewards.slice(0,30).map(({id,amount,currency,kind,role,createdAt})=>({id,amount,currency,kind,role,createdAt}))};
  }
  save(){
    const dir=path.dirname(this.filename);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const tmp=`${this.filename}.tmp`;
    fs.writeFileSync(tmp,JSON.stringify({codes:Object.fromEntries(this.codes),referrals:Object.fromEntries(this.referrals),ledger:this.ledger}),{mode:0o600});
    fs.renameSync(tmp,this.filename);
  }
}
