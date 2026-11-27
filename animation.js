// Pose calculations use travelled distance, never wall-clock animation timers.
export function idleAtlasFor(walkAtlas){
 if(!walkAtlas)return null;
 if(walkAtlas==='pukie-walk')return 'pukie-idle';
 if(walkAtlas==='uygar-walk')return 'uygar-idle';
 if(walkAtlas==='berkay-walk')return 'berkay-idle';
 if(walkAtlas==='berkay-hat-walk'||walkAtlas==='berkay-hat-glasses-walk')return 'berkay-hat-idle';
 return null;
}
export function idleSeed(actor){
 const s=String(actor.id||actor.name||'x')+','+String(actor.person||actor.sprite||'');
 let h=2166136261;
 for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
 return (h>>>0)/4294967296;
}
export function ensureIdle(actor){
 if(!actor.idle){
  const seed=idleSeed(actor);
  actor.idle={col:0,mode:'stand',t:0,next:2+seed*2,glanceDir:null,plantedFor:0,roam:null,seed,clock:seed*3.4,bounce:0,bob:0,nextWag:1.2+seed*1.2,nextSniff:2.8+seed*2.2,sitAfter:6+seed*2.5,nextRoam:10+seed*5,perkT:0};
 }
 return actor.idle;
}
export function resetIdle(actor){
 const idle=ensureIdle(actor);
 idle.col=0;idle.mode='stand';idle.t=0;idle.glanceDir=null;idle.plantedFor=0;idle.bounce=0;idle.bob=0;idle.perkT=0;
 idle.next=2+(idle.seed||0)*2;idle.nextWag=1.2+(idle.seed||0)*1.2;idle.nextSniff=2.8+(idle.seed||0)*2.2;idle.nextRoam=10+(idle.seed||0)*5;
 if(idle.roam)idle.roam=null;
}
export function breathScale(time,seed){
 return 1+0.0075*Math.sin((time+(seed||0)*3.4)*2*Math.PI/3.4);
}
export function stepIdle(actor,dt,opts={}){
 const reduced=!!opts.reduced;
 const idle=ensureIdle(actor);
 const planted=!!(actor.planted??(!actor.moving||(actor.velocity||0)<8));
 idle.clock=(idle.clock||0)+dt;
 idle.bounce=0;idle.bob=0;
 if(!planted){resetIdle(actor);return idle;}
 idle.plantedFor+=dt;
 idle.t+=dt;
 if(reduced){idle.col=idleAtlasFor(actor.atlas)?0:2;idle.mode='stand';idle.glanceDir=null;return idle;}
 if(actor.dog)return stepDogIdle(actor,dt,opts,idle);
 if(actor.hero||actor.party)return stepHumanIdle(actor,dt,idle,!!idleAtlasFor(actor.atlas));
 return stepNpcIdle(actor,dt,idle);
}
function stepHumanIdle(actor,dt,idle,hasSheet){
 const hold=()=>1.8+Math.random()*.8,cadence=()=>2.8+Math.random()*2.4;
 if(!hasSheet){
  idle.col=2;
  if(idle.mode==='stand'){
   idle.glanceDir=null;
   if(idle.t>=idle.next){idle.mode='glance';idle.t=0;const dir=actor.direction||0;idle.glanceDir=Math.random()<.5?(dir+1)%4:(dir+3)%4;idle.next=hold();}
  }else if(idle.t>=idle.next){idle.mode='stand';idle.glanceDir=null;idle.t=0;idle.next=cadence();}
  return idle;
 }
 if(idle.mode==='stand'){
  idle.col=0;idle.glanceDir=null;
  if(idle.t>=idle.next){
   const r=Math.random();
   const act=r<.25?'look':r<.57?'gesture1':r<.85?'gesture2':'glance';
   idle.mode=act;idle.t=0;idle.next=hold();
   if(act==='look')idle.col=1;
   else if(act==='gesture1')idle.col=2;
   else if(act==='gesture2')idle.col=3;
   else{idle.col=Math.random()<.5?0:1;const dir=actor.direction||0;idle.glanceDir=Math.random()<.5?(dir+1)%4:(dir+3)%4;}
  }
 }else if(idle.t>=idle.next){
  idle.mode='stand';idle.col=0;idle.glanceDir=null;idle.t=0;idle.next=cadence();
 }
 return idle;
}
function stepNpcIdle(actor,dt,idle){
 idle.col=2;
 if(idle.mode==='stand'){
  idle.glanceDir=null;
  if(idle.t>=idle.next){idle.mode='glance';idle.t=0;const dir=actor.direction||0;idle.glanceDir=Math.random()<.5?(dir+1)%4:(dir+3)%4;idle.next=1.8+Math.random()*.8;}
 }else if(idle.t>=idle.next){idle.mode='stand';idle.glanceDir=null;idle.t=0;idle.next=4+Math.random()*5;}
 return idle;
}
function stepDogIdle(actor,dt,opts,idle){
 const roam=idle.roam;
 if(roam&&(roam.stage==='go'||roam.stage==='back'))return idle;
 if(roam&&(roam.stage==='sniff'||roam.stage==='wag')){
  if(roam.stage==='wag'){const hz=4.5;idle.col=Math.floor(idle.t*hz)%2;idle.bounce=Math.abs(Math.sin(idle.t*hz*Math.PI))*1.6;}
  else{idle.col=2;idle.bob=Math.sin(idle.t*10)*1.1;}
  return idle;
 }
 if(idle.mode==='wag'){
  const hz=4.5;idle.col=Math.floor(idle.t*hz)%2;idle.bounce=Math.abs(Math.sin(idle.t*hz*Math.PI))*1.6;
  if(idle.t>=1.5){idle.mode='stand';idle.col=0;idle.t=0;idle.bounce=0;idle.nextWag=2+Math.random()*2;}
  return idle;
 }
 if(idle.mode==='sniff'){
  idle.col=2;idle.bob=Math.sin(idle.t*10)*1.1;
  if(idle.t>=idle.next){idle.mode='stand';idle.col=0;idle.t=0;idle.bob=0;idle.nextSniff=4+Math.random()*3.5;}
  return idle;
 }
 if(idle.mode==='sit'){
  idle.col=3;
  if(idle.perkT>0){idle.perkT-=dt;idle.col=1;idle.bounce=.55;}
  else if(Math.random()<dt*.12)idle.perkT=.35+Math.random()*.25;
  return idle;
 }
 idle.col=0;
 idle.nextWag=(idle.nextWag??2.5)-dt;
 idle.nextSniff=(idle.nextSniff??5)-dt;
 if(idle.nextWag<=0){idle.mode='wag';idle.t=0;return idle;}
 if(idle.nextSniff<=0){idle.mode='sniff';idle.t=0;idle.next=2.4+Math.random()*.8;return idle;}
 if(opts.nearLeader!==false&&idle.plantedFor>=(idle.sitAfter||10)){idle.mode='sit';idle.t=0;idle.col=3;}
 return idle;
}
export function gaitPose(actor,reduced=false){
 const cycle=(((actor.phase||0)%4)+4)%4/4;
 const speed=actor.velocity||0;
 const planted=actor.planted??(!actor.moving||speed<8);
 const idle=actor.idle;
 if(planted){
  const hasSheet=!!idleAtlasFor(actor.atlas);
  const frame=hasSheet?(idle?.col??0):2;
  return {frame,cycle,lift:0,sway:0,lean:0,planted:true,idle:true,bounce:idle?.bounce||0,bob:idle?.bob||0,breath:reduced?1:breathScale(idle?.clock||0,idle?.seed||0)};
 }
 const lift=reduced?0:Math.abs(Math.sin(cycle*2*Math.PI))*(actor.dog?.35:.85);
 const sway=reduced?0:Math.sin(cycle*2*Math.PI)*(actor.dog?.55:1.15);
 const lean=reduced?0:Math.sin(cycle*2*Math.PI)*(actor.dog?.7:1.35)*Math.PI/180;
 return {frame:Math.floor(cycle*4)%4,cycle,lift,sway,lean,planted:false,bounce:0,bob:0,breath:1};
}
export function spritePose(frame,stature){
 const b=frame.bounds||{x:0,y:0,w:frame.w,h:frame.h},scale=stature/b.h;
 const anchors=frame.anchors||{crown:{x:b.w/2,y:2},face:{x:b.w/2,y:b.h*.12},hip:{x:b.w/2,y:b.h*.54},hand:{x:b.w*.7,y:b.h*.55},headWidth:b.w*.3};
 const point=p=>({x:(p.x-b.w/2)*scale,y:(p.y-b.h)*scale});
 return {source:{x:frame.x+b.x,y:frame.y+b.y,w:b.w,h:b.h},width:b.w*scale,height:stature,crown:point(anchors.crown),face:point(anchors.face),hip:point(anchors.hip),hand:point(anchors.hand),headWidth:anchors.headWidth*scale};
}
export function boneAffine(a,b,A,B){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ex=B.x-A.x,ey=B.y-A.y,next=Math.hypot(ex,ey)||1;
 const ux=dx/len,uy=dy/len,vx=ex/next,vy=ey/next,s=next/len;
 const m11=vx*s*ux+vy*uy,m12=vy*s*ux-vx*uy,m21=vx*s*uy-vy*ux,m22=vy*s*uy+vx*ux;
 return [m11,m12,m21,m22,A.x-m11*a.x-m21*a.y,A.y-m12*a.x-m22*a.y];
}
export function kneeFor(hip,foot,upper,lower,bend=1){
 const dx=foot.x-hip.x,dy=foot.y-hip.y,d=Math.max(.01,Math.min(Math.hypot(dx,dy),upper+lower-.01)),raw=Math.hypot(dx,dy)||1,ux=dx/raw,uy=dy/raw;
 const along=(upper*upper-lower*lower+d*d)/(2*d),side=Math.sqrt(Math.max(0,upper*upper-along*along))*bend;
 return {x:hip.x+ux*along-uy*side,y:hip.y+uy*along+ux*side};
}
export function footTargets(actor,cycle,hip,lift=0){
 const diagonal=[[.85,.42],[-.85,.42],[-.85,-.42],[.85,-.42]][actor.direction||0],len=Math.hypot(...diagonal);
 const forward=actor.heading?[actor.heading.x,actor.heading.y]:diagonal.map(v=>v/len);
 return [0,1].map(i=>{
 const p=(cycle+i*.5)%1,stance=.58,stride=60*stance;
 let along=0,up=0;if(actor.moving){if(p<stance)along=(.5-p/stance)*stride;else{const t=(p-stance)/(1-stance);along=(t-.5)*stride;up=Math.sin(t*Math.PI)*6;}}
 return {x:hip.x+(i===0?6:-6)+forward[0]*along,y:(i===0?1:-2)+forward[1]*along-up+lift};
 });
}
