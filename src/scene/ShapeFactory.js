import*as THREE from"three";
export const COLORS=[0x46e7ff,0xff725c,0xb38cff,0xffd166,0x65e6a5,0xff82c8];
export function makeShape(kind,color=COLORS[Math.floor(Math.random()*COLORS.length)],pos=new THREE.Vector3(),id=crypto.randomUUID()){
const geo={tetra:new THREE.TetrahedronGeometry(1.05),ico:new THREE.IcosahedronGeometry(1.12,1),octa:new THREE.OctahedronGeometry(1.05),torus:new THREE.TorusKnotGeometry(.72,.23,80,16),box:new THREE.BoxGeometry(1.5,1.5,1.5)}[kind]||new THREE.IcosahedronGeometry(1.1,1);
const mat=new THREE.MeshPhysicalMaterial({color,transparent:true,opacity:.72,roughness:.17,metalness:.13,transmission:.05,side:THREE.DoubleSide});
const o=new THREE.Mesh(geo,mat);o.position.copy(pos);o.userData={id,kind,selected:false,grabber:null,velocity:new THREE.Vector3(),lastPos:o.position.clone(),baseScale:1};
o.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.24})));
const ring=new THREE.Mesh(new THREE.RingGeometry(1.17,1.22,64),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide}));ring.rotation.x=Math.PI/2;ring.userData.ring=true;o.add(ring);return o}
export function applyMaterial(o,s={}){o.userData.materialSettings={...o.userData.materialSettings,...s};o.traverse?.(c=>{if(!c.isMesh||!c.material)return;const m=c.material;if(s.color!==undefined)m.color.set(s.color);if(s.opacity!==undefined){m.transparent=s.opacity<.995;m.opacity=s.opacity}if(s.roughness!==undefined&&"roughness"in m)m.roughness=s.roughness;if(s.metalness!==undefined&&"metalness"in m)m.metalness=s.metalness;if(s.transmission!==undefined&&"transmission"in m)m.transmission=s.transmission})}
