<script setup lang="ts">
import { computed } from 'vue'
import { createObstacleScene, partCorners, rotatePoint } from '../game/obstacle-scene'
import type { ObstacleId } from '../game/obstacles'
import type { Position } from '../game/level-types'
import { state } from '../state'
import { themedPrimitiveColor, trackTheme } from '../game/track-themes'
const props=defineProps<{ id: ObstacleId }>()
const picture=computed(()=>{
  const scene=createObstacleScene(props.id),parts=scene.frame(.6).filter(p=>!p.hidden)
  const project=([x,y,z]:Position)=>({x:(x-z)*.707,y:(x+z)*.31-y*.9,depth:x+z+y*.3})
  const faces:{points:ReturnType<typeof project>[];color:string;shade:number;depth:number}[]=[]
  const spheres:{point:ReturnType<typeof project>;radius:number}[]=[]
  const colors:Record<string,string>={cream:'#fff7df',edge:'#b7cac4',orange:'#e77d43',dark:'#48656a',blue:'#9bc5cc'}
  for(const part of parts) {
    if(part.type==='sphere'){spheres.push({point:project(part.position),radius:part.size[0]/2});continue}
    const corners=partCorners(part)
    let polygons:number[][]=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[0,3,2,1]]
    let vertices=corners
    if(part.type==='cylinder') {
      vertices=[];const count=16,axis=part.collisionAxis===2?2:1
      for(const sign of [-1,1])for(let i=0;i<count;i++){
        const angle=i/count*Math.PI*2
        const local:Position=axis===2?[Math.cos(angle)*part.size[0]/2,Math.sin(angle)*part.size[1]/2,sign*part.size[2]/2]:[Math.cos(angle)*part.size[0]/2,sign*part.size[1]/2,Math.sin(angle)*part.size[2]/2]
        vertices.push(rotatePoint(local,part.rotation).map((v,j)=>v+part.position[j]!) as Position)
      }
      polygons=[Array.from({length:count},(_,i)=>i),Array.from({length:count},(_,i)=>i+count),...Array.from({length:count},(_,i)=>[i,(i+1)%count,(i+1)%count+count,i+count])]
    }
    for(const [index,polygon] of polygons.entries()) {
      const points=polygon.map(i=>project(vertices[i]!))
      const model=scene.models.find(model=>model.replaces.includes(part.name)),original=colors[part.material]??'#afc5be'
      const color=part.protectedTheme||model?.handle?original:state.settings.trackTheme!=='classic'&&model?.file.startsWith('hammer-head-toy')?trackTheme(state.settings.trackTheme).roles.hammer.color:themedPrimitiveColor(state.settings.trackTheme,part.material,original)
      faces.push({points,color,shade:part.type==='cylinder'?index>1?.08+(index%5)*.025:0:[.16,.07,.04,.13,0,.25][index]!,depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length})
    }
  }
  const points=faces.flatMap(f=>f.points),minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y))
  const scale=Math.min(280/Math.max(1,maxX-minX),160/Math.max(1,maxY-minY))
  return {faces:faces.sort((a,b)=>a.depth-b.depth).map(f=>({...f,polygon:f.points.map(p=>`${160+(p.x-(minX+maxX)/2)*scale},${106+(p.y-(minY+maxY)/2)*scale}`).join(' ')})),spheres:spheres.map(s=>({x:160+(s.point.x-(minX+maxX)/2)*scale,y:106+(s.point.y-(minY+maxY)/2)*scale,r:Math.max(3,s.radius*scale)}))}
})
</script>
<template>
  <svg viewBox="0 0 320 220" class="obstacle-thumbnail" aria-hidden="true">
    <ellipse cx="160" cy="184" rx="117" ry="16" fill="#46675b" opacity=".07"/>
    <g v-for="(face,index) in picture.faces" :key="index"><polygon :points="face.polygon" :fill="face.color" stroke="#49645e" stroke-opacity=".1" stroke-width=".45" stroke-linejoin="round"/><polygon :points="face.polygon" fill="#173c37" :opacity="face.shade"/></g>
    <g v-for="(sphere,index) in picture.spheres" :key="`sphere-${index}`"><circle :cx="sphere.x" :cy="sphere.y" :r="sphere.r" fill="#789493"/><circle :cx="sphere.x-sphere.r*.25" :cy="sphere.y-sphere.r*.3" :r="sphere.r*.36" fill="#faffed"/></g>
  </svg>
</template>
<style scoped lang="less">
.obstacle-thumbnail { display:block; width:100%; height:100%; }
</style>
