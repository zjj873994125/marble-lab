<script setup lang="ts">
import { computed, useId } from 'vue'
import type { LevelConfig, Position, PrimitiveConfig } from '../game/level-types'
import { turntablePose } from '../game/mechanism-motion'
import { partCorners, rotatePoint } from '../game/obstacle-scene'
import { libraryFallback } from '../game/library-visuals'
import { state } from '../state'
import { themedPrimitiveColor, trackTheme } from '../game/track-themes'

const props = defineProps<{ level: LevelConfig }>()
const imageId = useId()
const picture = computed(() => {
  const level = props.level
  const teaching = !!level.pendulum
  const libraryMechanism = level.mechanisms?.find(config=>config.kind==='weight-seesaw') ?? level.mechanisms?.[0]
  const libraryParts = libraryMechanism ? libraryFallback(libraryMechanism,1,libraryMechanism.kind==='weight-seesaw'?(libraryMechanism.restAngle??8):0) : []
  // 固定局部取景，不再把整条赛道压进一张线路图；只影响缩略图相机。
  const focus: Position = teaching ? [-6.5, 3.4, -3] : libraryMechanism ? [libraryMechanism.position[0],libraryMechanism.position[1]+3.4,libraryMechanism.position[2]] : [level.turntable!.position[0], 2.5, level.turntable!.position[2]]
  const scale = teaching ? 22 : libraryMechanism ? 26 : 21
  const project = ([x,y,z]: Position) => ({ x: 150 + ((x-focus[0])-(z-focus[2]))*.707*scale, y: 130 + (((x-focus[0])+(z-focus[2]))*.36-(y-focus[1])*.86)*scale, depth:x+z+y*.84 })
  const box = (name:string,position:Position,size:Position,material:PrimitiveConfig['material']):PrimitiveConfig => ({name,type:'box',position,size,material})
  const objects:PrimitiveConfig[] = []
  if (teaching) {
    objects.push(...level.staticObjects.filter(object => !object.name.startsWith('Pool') && object.position[0] >= -12 && object.position[0] <= 0 && object.position[2] <= 5))
    const h = level.pendulum!, time = .65
    const offset = Math.sin(time*h.angularSpeed)*h.amplitude
    const head:Position = [h.ball.position[0],h.ball.position[1]+Math.abs(offset)*h.lift,h.ball.position[2]+offset]
    const dy = h.anchor[1]-head[1], dz = h.anchor[2]-head[2]
    const rotation:Position = [Math.atan2(dz,dy)*180/Math.PI,0,0]
    objects.push({...h.ball,position:head,rotation}, {...h.rod,position:[head[0],(head[1]+h.anchor[1])/2,(head[2]+h.anchor[2])/2],rotation,size:[h.rodWidth,Math.hypot(dy,dz),h.rodWidth]})
  } else if (libraryMechanism) {
    objects.push(...level.staticObjects.filter(object=>object.body==='static'&&Math.hypot(object.position[0]-focus[0],object.position[2]-focus[2])<7))
    const yaw=libraryMechanism.yaw??0
    for(const part of libraryParts) {
      const local=rotatePoint(part.position,[0,yaw,0])
      objects.push({...part,position:local.map((v,i)=>v+libraryMechanism.position[i]!) as Position,rotation:[part.rotation?.[0]??0,yaw+(part.rotation?.[1]??0),part.rotation?.[2]??0]})
    }
  } else {
    const banks = level.staticObjects.filter(object => ['turntable-approach-island','turntable-entry-tongue','turntable-exit-tongue','turntable-exit-island','turntable-to-lifts-link'].includes(object.name))
    for (const bank of banks) {
      objects.push(bank)
      // 整关GLB的底座/支撑没有独立配置；在真实台面下补轻量同风格外观。
      objects.push(box(`${bank.name}-chassis`,[bank.position[0],bank.position[1]-.27,bank.position[2]],[bank.size[0]+.08,.18,bank.size[2]+.08],'edge'))
      if(bank.size[2]>2) objects.push(box(`${bank.name}-support`,[bank.position[0],1.2,bank.position[2]],[.42,2.8,.42],'dark'))
    }
    const cross = level.turntable!, pose = turntablePose(cross,.3)
    for(const [index,part] of cross.parts.entries()) {
      objects.push({...part,position:pose.parts[index]!,rotation:pose.rotation})
      objects.push({...part,name:`${part.name}-base`,position:[pose.parts[index]![0],pose.parts[index]![1]-.29,pose.parts[index]![2]],size:[part.size[0],.12,part.size[2]],rotation:pose.rotation,material:'edge'})
    }
    objects.push({name:'Cross axle',type:'cylinder',position:[cross.position[0],1.3,cross.position[2]],size:[.65,2.6,.65],material:'dark'})
  }
  const palette:Record<string,string> = {cream:'#fff6de',edge:'#b4c9c3',orange:'#eea343',blue:'#9ac6cf',dark:'#426169'}
  for(const key of Object.keys(palette))palette[key]=themedPrimitiveColor(state.settings.trackTheme,key,palette[key]!)
  const faces:{polygon:string;color:string;depth:number}[]=[]
  const shadows:string[]=[]
  const polygon = (points:Position[]) => points.map(point => {const p=project(point);return `${p.x},${p.y}`}).join(' ')
  const shade = (hex:string,light:number) => `rgb(${[1,3,5].map(offset=>Math.round(parseInt(hex.slice(offset,offset+2),16)*light)).join(',')})`
  for(const part of objects) {
    let vertices=partCorners(part)
    let polygons=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[0,3,2,1]]
    if(part.type==='cylinder') {
      vertices=[]
      const sides=20,axis=part.collisionAxis===2?2:1
      for(const sign of [-1,1])for(let i=0;i<sides;i++) {
        const angle=i/sides*Math.PI*2
        const local:Position=axis===2?[Math.cos(angle)*part.size[0]/2,Math.sin(angle)*part.size[1]/2,sign*part.size[2]/2]:[Math.cos(angle)*part.size[0]/2,sign*part.size[1]/2,Math.sin(angle)*part.size[2]/2]
        vertices.push(rotatePoint(local,part.rotation).map((v,j)=>v+part.position[j]!) as Position)
      }
      polygons=[Array.from({length:sides},(_,i)=>i),Array.from({length:sides},(_,i)=>i+sides),...Array.from({length:sides},(_,i)=>[i,(i+1)%sides,(i+1)%sides+sides,i+sides])]
    }
    for(const [index,indices] of polygons.entries()) {
      const points=indices.map(i=>vertices[i]!)
      const brightness=part.type==='cylinder'?(index<2?.97:.65+.3*(.5+.5*Math.cos((index-2)*Math.PI/10))):[.7,.84,.92,.76,1,.58][index]!
      const color=state.settings.trackTheme!=='classic'&&teaching&&part.name===level.pendulum!.ball.name?trackTheme(state.settings.trackTheme).roles.hammer.color:palette[part.material]??'#fff6de'
      faces.push({polygon:polygon(points),color:shade(color,brightness),depth:points.reduce((sum,p)=>sum+project(p).depth,0)/points.length})
      // 光线投影到水面；整组透明合成，交叠处不会反复变黑。
      shadows.push(polygon(points.map(([x,y,z])=>[x+(y+.1)*.6,-.1,z+(y+.1)*.3] as Position)))
    }
  }
  let ball:Position=teaching?[-8.9,3.825,-3.3]:[focus[0],3.825,focus[2]+5.5]
  if(libraryMechanism) {
    const deck=libraryParts[0]!
    const offset=rotatePoint([0,deck.size[1]/2+.425,.4],deck.rotation)
    const local=deck.position.map((v,i)=>v+offset[i]!) as Position
    ball=rotatePoint(local,[0,libraryMechanism.yaw??0,0]).map((v,i)=>v+libraryMechanism.position[i]!) as Position
  }
  const sphere=project(ball),sphereRadius=.425*scale
  const ballShadow=project([ball[0]+.14,3.405,ball[2]+.12])
  const water=trackTheme(state.settings.trackTheme).roles.water.color
  return {faces:faces.sort((a,b)=>a.depth-b.depth),shadows,sphere,sphereRadius,ballShadow,waterTop:state.settings.trackTheme==='classic'?'#427d81':shade(water,1.12),waterBottom:state.settings.trackTheme==='classic'?'#22525c':water}
})
</script>

<template>
  <svg viewBox="0 0 300 210" class="level-thumbnail" aria-hidden="true">
    <defs>
      <linearGradient :id="`${imageId}-water`" x1="0" y1="0" x2="1" y2="1"><stop :stop-color="picture.waterTop"/><stop offset="1" :stop-color="picture.waterBottom"/></linearGradient>
      <radialGradient :id="`${imageId}-steel`" cx="32%" cy="25%"><stop stop-color="#fffef1"/><stop offset=".27" stop-color="#dce9e3"/><stop offset=".48" stop-color="#526a70"/><stop offset=".75" stop-color="#a9c0c0"/><stop offset="1" stop-color="#354c54"/></radialGradient>
      <filter :id="`${imageId}-shadow`" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1"/></filter>
      <clipPath :id="`${imageId}-crop`"><rect width="300" height="210" rx="12"/></clipPath>
    </defs>
    <g :clip-path="`url(#${imageId}-crop)`">
      <rect width="300" height="210" :fill="`url(#${imageId}-water)`"/>
      <g fill="none" stroke="#cce8d8" stroke-opacity=".12" stroke-width=".7"><path d="M-20 36Q28 27 56 35T128 31M184 21Q221 16 261 23T323 20M-13 167Q32 155 75 164M193 184Q240 175 314 186"/></g>
      <g fill="#082f3b" opacity=".28" :filter="`url(#${imageId}-shadow)`"><polygon v-for="(shadow,index) in picture.shadows" :key="index" :points="shadow"/></g>
      <g stroke="#fff9e5" stroke-opacity=".12" stroke-width=".35" stroke-linejoin="round"><polygon v-for="(face,index) in picture.faces" :key="index" :points="face.polygon" :fill="face.color"/></g>
      <ellipse :cx="picture.ballShadow.x" :cy="picture.ballShadow.y" :rx="picture.sphereRadius*1.1" :ry="picture.sphereRadius*.48" fill="#173d43" opacity=".24"/>
      <circle :cx="picture.sphere.x" :cy="picture.sphere.y" :r="picture.sphereRadius" :fill="`url(#${imageId}-steel)`"/>
    </g>
  </svg>
</template>

<style scoped lang="less">
.level-thumbnail { display:block; width:100%; height:auto; aspect-ratio:10/7; }
</style>
