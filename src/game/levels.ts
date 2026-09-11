import initialGravity from '../levels/initial-gravity'
import type { LevelConfig } from './level-types'

export interface LevelEntry {
  config: LevelConfig
  number: string
  title: string
  description: string
  medals?: [number, number, number]
}

// 这里只注册已交付运行配置的关卡；设计 JSON 不直接作为可玩内容加载。
export const levelCatalog: LevelEntry[] = [
  { config: initialGravity, number: '01', title: '教学关卡', description: '弯道 · 摆锤 · 移动平台', medals: [35, 55, 90] },
]
