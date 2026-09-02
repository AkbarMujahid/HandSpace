export function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)}
export function pinch(h){return dist(h[4],h[8])<.075}
export function openPalm(h){const w=h[0],tips=[8,12,16,20],pips=[6,10,14,18];let n=0;for(let i=0;i<4;i++)if(dist(w,h[tips[i]])>dist(w,h[pips[i]])*1.15)n++;return n>=3}
export function fist(h){const w=h[0],tips=[8,12,16,20],pips=[6,10,14,18];return tips.every((t,i)=>dist(w,h[t])<dist(w,h[pips[i]])*1.15)}
export function roll(h){const a=h[5],b=h[17];return Math.atan2(a.y-b.y,a.x-b.x)}
export function palmDepth(h){return h[9].z}
export function palmCenter(h){return[0,5,9,13,17].reduce((p,i)=>({x:p.x+h[i].x/5,y:p.y+h[i].y/5,z:p.z+h[i].z/5}),{x:0,y:0,z:0})}
export function thumbUp(h){const w=h[0],t=h[4];return t.y<h[3].y&&t.y<w.y&&[8,12,16,20].every((x,i)=>dist(w,h[x])<dist(w,h[[6,10,14,18][i]])*1.2)}
export function peace(h){const w=h[0],iu=dist(w,h[8])>dist(w,h[6])*1.18,mu=dist(w,h[12])>dist(w,h[10])*1.18,rd=dist(w,h[16])<dist(w,h[14])*1.12,pd=dist(w,h[20])<dist(w,h[18])*1.12;return iu&&mu&&rd&&pd}
