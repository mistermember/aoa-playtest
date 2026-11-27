// Pure movement primitives. World units match the 1536 x 1024 environment plates.
export const WORLD_W=1536, WORLD_H=1024, CELL=32;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function insidePolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function buildGrid(polygon,obstacles=[],cell=CELL){const cols=Math.ceil(WORLD_W/cell),rows=Math.ceil(WORLD_H/cell),walk=new Uint8Array(cols*rows);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const px=x*cell+cell/2,py=y*cell+cell/2;walk[y*cols+x]=insidePolygon(px,py,polygon)&&!obstacles.some(p=>insidePolygon(px,py,p))?1:0;}return {cols,rows,cell,walk};}
export function isWalkable(grid,x,y){const cx=Math.floor(x/grid.cell),cy=Math.floor(y/grid.cell);return cx>=0&&cy>=0&&cx<grid.cols&&cy<grid.rows&&!!grid.walk[cy*grid.cols+cx];}
export function cellCenter(grid,index){return {x:(index%grid.cols+.5)*grid.cell,y:(Math.floor(index/grid.cols)+.5)*grid.cell};}
export function nearestCell(grid,x,y,maxDistance=Infinity){let best=-1,bestD=maxDistance*maxDistance;for(let i=0;i<grid.walk.length;i++){if(!grid.walk[i])continue;const p=cellCenter(grid,i),d=(p.x-x)**2+(p.y-y)**2;if(d<=bestD){best=i;bestD=d;}}return best;}
export function findPath(grid,start,end,maxSnap=72){
 const begin=nearestCell(grid,start.x,start.y),goal=nearestCell(grid,end.x,end.y,maxSnap);
 if(begin<0||goal<0)return null;
 if(begin===goal)return [cellCenter(grid,goal)];
 const size=grid.walk.length,cost=new Float64Array(size).fill(Infinity),parents=new Int32Array(size).fill(-1),closed=new Uint8Array(size),open=[begin];cost[begin]=0;
 const gx=goal%grid.cols,gy=Math.floor(goal/grid.cols),h=i=>Math.hypot(i%grid.cols-gx,Math.floor(i/grid.cols)-gy);
 const steps=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
 while(open.length){let best=0;for(let i=1;i<open.length;i++)if(cost[open[i]]+h(open[i])<cost[open[best]]+h(open[best]))best=i;const cur=open.splice(best,1)[0];if(cur===goal){const path=[];let i=cur;while(i!==begin){path.push(cellCenter(grid,i));i=parents[i];}return path.reverse();}closed[cur]=1;const x=cur%grid.cols,y=Math.floor(cur/grid.cols);
 for(const [dx,dy] of steps){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=grid.cols||ny>=grid.rows)continue;const ni=ny*grid.cols+nx;if(!grid.walk[ni]||closed[ni])continue;if(dx&&dy&&(!grid.walk[y*grid.cols+nx]||!grid.walk[ny*grid.cols+x]))continue;const next=cost[cur]+(dx&&dy?Math.SQRT2:1);if(next<cost[ni]){parents[ni]=cur;cost[ni]=next;if(!open.includes(ni))open.push(ni);}}
 }
 return null;
}
export function approachPoint(grid,from,target,radius=62){
 const choices=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,p={x:target.x+Math.cos(a)*radius,y:target.y+Math.sin(a)*radius};if(isWalkable(grid,p.x,p.y))choices.push(p);}choices.sort((a,b)=>distance(from,a)-distance(from,b));
 for(const p of choices){const path=findPath(grid,from,p,25);if(path)return path;}return null;
}
const RAMP=.14;
export function facingFrom(dx,dy,current){
 const ax=Math.abs(dx),ay=Math.abs(dy);
 let sx=dx;
 if(current!=null&&ay>=ax*.85){
  const east=current===0||current===3;
  if((dx>=0)===east||ax<ay*.38)sx=east?Math.max(ax,1):-Math.max(ax,1);
 }
 return dy>=0?(sx>=0?0:1):(sx<0?2:3);
}
export function coastTarget(actor,grid){
 const v=actor.velocity||0,a=actor.acceleration||0,h=actor.heading;
 if(v<8||!a||!h)return null;
 let dist=(v*v)/(2*a);
 for(let i=0;i<4;i++){
  const x=actor.x+h.x*dist,y=actor.y+h.y*dist;
  if(isWalkable(grid,x,y))return {x,y};
  dist*=.6;
 }
 return null;
}
export function stepActor(actor,dt){
 const elapsed=Math.min(.08,Math.max(0,dt));
 const accel=actor.acceleration||(actor.speed?actor.speed/RAMP:0);
 let speed=actor.speed;
 if(accel){
  let remaining=0,x=actor.x,y=actor.y;
  if(actor.holdVelocity)remaining=Infinity;
  else for(const p of actor.path||[]){remaining+=Math.hypot(p.x-x,p.y-y);x=p.x;y=p.y;}
  const stopDist=(speed*speed)/(2*Math.max(accel,.01));
  const cruise=actor.holdVelocity||remaining>stopDist+6;
  const target=(actor.path?.length||actor.holdVelocity)?Math.min(actor.speed,cruise?actor.speed:Math.sqrt(2*accel*Math.max(remaining,.01))):0;
  const velocity=actor.velocity||0;
  actor.velocity=velocity+Math.sign(target-velocity)*Math.min(Math.abs(target-velocity),accel*elapsed);
  speed=actor.velocity;
 }
 const stride=actor.dog?10:(actor.hero||actor.party)?16:13; // v5.0.9b: brothers' sheets are true A(stride)/P(passing)/B(opposite stride)/P cycles = 2 steps per 64 units; NPC sheets keep 52
 let budget=speed*elapsed,moved=0;
 while(budget>0&&actor.path?.length){
  const target=actor.path[0],dx=target.x-actor.x,dy=target.y-actor.y,d=Math.hypot(dx,dy);
  if(d<.01){actor.path.shift();continue;}
  const facing=facingFrom(dx,dy,actor.direction);
  if(facing!==actor.direction){
   actor.faceTimer=(actor.faceTimer||0)+elapsed;
   const flipLR=(facing===0||facing===3)!==(actor.direction===0||actor.direction===3);
   const nearVertical=Math.abs(dx)<Math.abs(dy)*.45;
   const hold=flipLR&&nearVertical?.16:.1;
   if(actor.faceTimer>hold||!actor.moving)actor.direction=facing;
  }else actor.faceTimer=0;
  actor.heading={x:dx/d,y:dy/d};
  const step=Math.min(budget,d);actor.x+=dx/d*step;actor.y+=dy/d*step;budget-=step;moved+=step;
  if(step>=d-.001)actor.path.shift();
 }
 if(moved>.01)actor.phase=(actor.phase||0)+moved/stride;
 actor.moving=moved>.01;
 const now=accel?(actor.velocity||0):moved/Math.max(elapsed,.0001);
 actor.planted=!actor.moving||now<8;
 if(!actor.path?.length&&!actor.holdVelocity){
  if(accel&&actor.velocity){actor.velocity=Math.max(0,actor.velocity-accel*elapsed);if(actor.velocity<8){actor.velocity=0;actor.planted=true;}}
  else actor.velocity=0;
 }
 return moved;
}
export function resolveSeparation(actor,others,grid,radius=17){for(const other of others){if(actor===other)continue;const d=distance(actor,other);if(d>0.01&&d<radius){const push=(radius-d)*.45,nx=actor.x+(actor.x-other.x)/d*push,ny=actor.y+(actor.y-other.y)/d*push;if(isWalkable(grid,nx,ny)){actor.x=nx;actor.y=ny;}}}}
export function separateCrowd(list,grid,radius=46){
 for(let pass=0;pass<10;pass++){
  for(let i=0;i<list.length;i++){
   for(let j=i+1;j<list.length;j++){
    const a=list[i],b=list[j];let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
    if(d<.01){dx=1;dy=(i-j)*.2;d=Math.hypot(dx,dy);}
    if(d<radius){
     const push=(radius-d)/2,nx=dx/d,ny=dy/d;
     const ax=a.x+nx*push,ay=a.y+ny*push,bx=b.x-nx*push,by=b.y-ny*push;
     if(!grid||isWalkable(grid,ax,ay)){a.x=ax;a.y=ay;}
     if(!grid||isWalkable(grid,bx,by)){b.x=bx;b.y=by;}
    }
   }
  }
 }
}
export function blockActors(grid,blockers,actor,radius=26){
 const next={cols:grid.cols,rows:grid.rows,cell:grid.cell,walk:grid.walk.slice()};
 const r2=radius*radius,cell=grid.cell;
 for(const b of blockers){
  if(!b||b===actor)continue;
  const x0=Math.max(0,Math.floor((b.x-radius)/cell)),x1=Math.min(grid.cols-1,Math.floor((b.x+radius)/cell));
  const y0=Math.max(0,Math.floor((b.y-radius)/cell)),y1=Math.min(grid.rows-1,Math.floor((b.y+radius)/cell));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const cx=(x+.5)*cell,cy=(y+.5)*cell;
   if((cx-b.x)**2+(cy-b.y)**2<=r2)next.walk[y*grid.cols+x]=0;
  }
 }
 if(actor){
  const ax=Math.floor(actor.x/cell),ay=Math.floor(actor.y/cell);
  if(ax>=0&&ay>=0&&ax<grid.cols&&ay<grid.rows)next.walk[ay*grid.cols+ax]=grid.walk[ay*grid.cols+ax];
 }
 return next;
}
