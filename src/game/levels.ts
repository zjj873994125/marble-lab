import initialGravity from '../levels/initial-gravity'
import waterRush from '../levels/water-rush'
import mechanismTrial from '../levels/mechanism-trial'
import topDifficulty from '../levels/top-difficulty'
import threeRoute from '../levels/three-route'
import advancedTrial from '../levels/advanced-trial'
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
  { config: waterRush, number: '02', title: '水上冲关', description: '三锤 · 十字台 · 蛇形回头弯 · 细梁冲坡' },
  { config: mechanismTrial, number: '03', title: '机关试炼', description: '推墙 · 翻板 · 跷跷板 · 滚筒 · 吊桥' },
  { config: topDifficulty, number: '挑战', title: '顶级难度关卡', description: '10段连环 · 13类机关 · 极限长线' },
  { config: threeRoute, number: '04', title: '三路分流', description: '三路分流 · 自选路线 · 汇合冲刺' },
  { config: advancedTrial, number: '试验', title: '高阶机关试验场', description: '蹦床 · 喷流 · 曲轨 · 坍塌桥' },
]
