import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {cleanText} from './store.js';

export const PROMOTION_SLOTS = [
  {id:'lobby_feature',label:'หน้า Lobby · พื้นที่ประชาสัมพันธ์'},
  {id:'contacts_feature',label:'หน้า Contacts · ข่าวเด่น'}
];
const slotIds=new Set(PROMOTION_SLOTS.map(slot=>slot.id));
const mediaKinds=new Set(['news','image','video']);

export class PromotionStore {
  constructor(filename){this.filename=filename;this.items=[];try{const saved=JSON.parse(fs.readFileSync(filename,'utf8'));if(Array.isArray(saved))this.items=saved.filter(item=>item&&typeof item.id==='string'&&slotIds.has(item.slot));}catch(error){if(error.code!=='ENOENT')throw error;}}
  list(){return this.items.map(item=>({...item})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  active(slot,now=Date.now()){return this.items.filter(item=>item.status==='published'&&item.slot===slot&&Date.parse(item.startsAt)<=now&&(!item.endsAt||Date.parse(item.endsAt)>now)).sort((a,b)=>Date.parse(b.startsAt)-Date.parse(a.startsAt))[0]||null;}
  saveItem(input,id=null){
    const title=cleanText(input?.title,100),body=cleanText(input?.body,1200),kind=input?.kind,slot=input?.slot,status=input?.status;
    if(!title||!body)throw new Error('กรุณาระบุหัวข้อและเนื้อหา');
    if(!mediaKinds.has(kind)||!slotIds.has(slot)||!['draft','published'].includes(status))throw new Error('ข้อมูลประเภทเนื้อหา ตำแหน่ง หรือสถานะไม่ถูกต้อง');
    const mediaUrl=cleanMediaUrl(input?.mediaUrl,kind),linkUrl=cleanUrl(input?.linkUrl);
    if(kind!=='news'&&!mediaUrl)throw new Error(kind==='image'?'เพิ่มลิงก์หรืออัปโหลดรูปภาพ':'เพิ่มลิงก์หรืออัปโหลดวิดีโอ');
    const startsAt=validDate(input?.startsAt,'เวลาเริ่มเผยแพร่'),endsAt=input?.endsAt?validDate(input.endsAt,'เวลาสิ้นสุด'):'';
    if(endsAt&&Date.parse(endsAt)<=Date.parse(startsAt))throw new Error('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มเผยแพร่');
    const previous=id?this.items.find(item=>item.id===id):null;if(id&&!previous)throw new Error('ไม่พบรายการนี้');
    if(status==='published'){
      const start=Date.parse(startsAt),end=endsAt?Date.parse(endsAt):Infinity;
      const overlap=this.items.some(item=>item.id!==previous?.id&&item.status==='published'&&item.slot===slot&&start<Date.parse(item.endsAt||'9999-12-31T23:59:59.999Z')&&Date.parse(item.startsAt)<end);
      if(overlap)throw new Error('พื้นที่นี้มีรายการเผยแพร่ในช่วงเวลาดังกล่าวแล้ว');
    }
    const now=new Date().toISOString();const item={id:previous?.id||crypto.randomUUID(),title,body,kind,slot,status,mediaUrl:kind==='news'?'':mediaUrl,linkUrl,startsAt,endsAt,createdAt:previous?.createdAt||now,updatedAt:now};
    this.items=this.items.filter(value=>value.id!==item.id);this.items.push(item);this.persist();return {...item};
  }
  remove(id){const count=this.items.length;this.items=this.items.filter(item=>item.id!==id);if(count===this.items.length)return false;this.persist();return true;}
  persist(){fs.mkdirSync(path.dirname(this.filename),{recursive:true,mode:0o700});const tmp=`${this.filename}.tmp`;fs.writeFileSync(tmp,JSON.stringify(this.items),{mode:0o600});fs.renameSync(tmp,this.filename);}
}
function cleanUrl(value){if(value===undefined||value==='')return '';if(typeof value!=='string')throw new Error('ลิงก์ไม่ถูกต้อง');let url;try{url=new URL(value.trim());}catch{throw new Error('กรุณาใส่ลิงก์ที่ถูกต้อง');}if(url.protocol!=='https:'||url.username||url.password||url.href.length>1200)throw new Error('ใช้ได้เฉพาะลิงก์ HTTPS');return url.href;}
function cleanMediaUrl(value,kind){if(value===undefined||value==='')return '';if(typeof value!=='string')throw new Error('ลิงก์สื่อไม่ถูกต้อง');const media=value.trim();const local=/^\/api\/promotions\/media\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$/i.exec(media);if(local){const image=['jpg','png','webp'].includes(local[1].toLowerCase()),video=['mp4','webm'].includes(local[1].toLowerCase());if((kind==='image'&&!image)||(kind==='video'&&!video))throw new Error('ชนิดไฟล์ไม่ตรงกับประเภทเนื้อหา');return media;}const url=cleanUrl(media);if(kind==='image'&&!(/\.(jpe?g|png|webp)(?:$|[?#])/i.test(url)))throw new Error('ลิงก์รูปภาพควรลงท้ายด้วย JPG, PNG หรือ WebP');if(kind==='video'&&!(/\.(mp4|webm)(?:$|[?#])/i.test(url)))throw new Error('ลิงก์วิดีโอต้องลงท้ายด้วย MP4 หรือ WebM');return url;}
function validDate(value,label){if(typeof value!=='string')throw new Error(`${label}ไม่ถูกต้อง`);const time=Date.parse(value);if(!Number.isFinite(time))throw new Error(`${label}ไม่ถูกต้อง`);return new Date(time).toISOString();}
