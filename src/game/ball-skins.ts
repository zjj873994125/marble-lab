export type BallSkinId = 'steel' | 'titanium' | 'rose-gold' | 'ice-blue' | 'ringed-steel' | 'basketball' | 'soccer' | 'tennis' | 'eight-ball'
export interface BallSkin {
  id:BallSkinId; name:string; color:string; metalness:number; roughness:number; reflectivity:number
  explicitDiffuse?:[number,number,number]
  maps?:{color:string;roughness:string;normal?:string}
  normalStrength?:number
  rings?:{color:string;gloss:number;centers:number[];width:number;feather:number}
}
export const ballSkins:BallSkin[]=[
  {id:'steel',name:'亮银钢球',color:'#D1D4D6',explicitDiffuse:[.82,.83,.84],metalness:1,roughness:.07,reflectivity:1},
  {id:'titanium',name:'黑钛',color:'#424C58',metalness:1,roughness:.14,reflectivity:1},
  {id:'rose-gold',name:'玫瑰金',color:'#C88F7B',metalness:1,roughness:.12,reflectivity:1},
  {id:'ice-blue',name:'冰蓝金属',color:'#74B8D6',metalness:.95,roughness:.10,reflectivity:1},
  {id:'ringed-steel',name:'环纹钢球',color:'#D1D4D6',explicitDiffuse:[.82,.83,.84],metalness:1,roughness:.07,reflectivity:1,rings:{color:'#7F8E99',gloss:.80,centers:[.32,.50,.68],width:.008,feather:.002}},
  {id:'basketball',name:'篮球',color:'#FFFFFF',metalness:0,roughness:.74,reflectivity:.35,normalStrength:.20,maps:{color:'basketball-basecolor.png',roughness:'basketball-roughness.png',normal:'basketball-normal.png'}},
  {id:'soccer',name:'足球',color:'#FFFFFF',metalness:0,roughness:.56,reflectivity:.40,normalStrength:.10,maps:{color:'soccer-basecolor.png',roughness:'soccer-roughness.png',normal:'soccer-normal.png'}},
  {id:'tennis',name:'网球',color:'#FFFFFF',metalness:0,roughness:.91,reflectivity:.18,normalStrength:.14,maps:{color:'tennis-basecolor.png',roughness:'tennis-roughness.png',normal:'tennis-normal.png'}},
  {id:'eight-ball',name:'桌球黑 8',color:'#FFFFFF',metalness:0,roughness:.12,reflectivity:.65,normalStrength:0,maps:{color:'eight-ball-basecolor.png',roughness:'eight-ball-roughness.png'}},
]
export function isBallSkin(value:unknown):value is BallSkinId { return ballSkins.some(skin=>skin.id===value) }
export function ballSkin(id:BallSkinId) { return ballSkins.find(skin=>skin.id===id)??ballSkins[0]! }
