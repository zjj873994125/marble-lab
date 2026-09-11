# LEVEL-02 · 显示配置冻结与模型接入交接

日期：2026-09-11。状态：LEVEL-02 显示数据与新静态模型引用已完成，已通知 CODE-02 最终集成验收；不以关卡交付替代游戏内视觉和玩法回归。

需求来源：`docs/product/round-02.md`。已查看两张原始用户截图并核对配置、类型、圆环创建及旧模型生成逻辑。仅修改关卡显示数据，不实施上一轮平台入口双线。

## 配置版本

- 文件：`src/levels/initial-gravity.ts`。
- 修改前 SHA-256：`fde23231e32481972724bd174a8880f76003d33e0353f018f54b0597cb5341b7`。
- 显示数据冻结 SHA-256：`7a5428efde261b928adf6ce5c62cdb26602ba612468ea86d1d58e15635125827`。
- 最终资源：`visuals.track = 'track-round-02.glb'`，`visuals.platform = 'platform-refined.glb'`。
- 最终配置 SHA-256：`42d3d338b8bd6ecf8e8eb537fd194028f23b7f5310f4611a2af0a7829bb3abcf`。相对显示冻结版仅变更静态模型文件名。

已在写入前核对最新源文件与本次临时内容基线一致。完整解析前值保存在 [before-config.json](/Users/zhongjijie/study/球球大作战/marble-lab/docs/levels/round-02-evidence/before-config.json)，只作审计，不用于覆盖当前配置。

## 圆环的前后数值与覆盖范围

圆环只修改 `checkpoints[n].ring`。真实 `position` 继续分别为 `[-1, 3.95, -4]`、`[8, 3.95, 5]`，顺序、水平触发半径 1.35、垂直容差 1.2 和重生逻辑均不变。

- 检查点 1：`ring.position [-1, 3.45, -4] → [-1.5, 3.46, -3.5]`；`ring.radius 1 → 0.55`。
- 检查点 2：`ring.position [8, 3.45, 5] → [7.5, 3.46, 4.5]`；`ring.radius 1 → 0.55`。
- 起点与终点圆环显示数据保持原值。

根因是原中心落在台面并集的内凹角：检查点 1 的 `x > -1 且 z < -4` 无台面，检查点 2 的 `x > 8 且 z > 5` 无台面；原圆环跨越缺角。此次向台面内对角移动，不通过抬高遮挡或修改深度测试掩盖问题。

按运行时 `tubeRadius = 0.045` 计算，圆环最大水平外半径为 `0.55 + 0.045 = 0.595`，两处均满足：

- 显示中心距检测中心为 `sqrt(0.5² + 0.5²) ≈ 0.707107` 米。
- 整个外缘距内凹角至少 `0.707107 - 0.595 ≈ 0.112107` 米，超过旧台面 0.065 米的倒角尺度；不是贴着缺角临界线。
- 整环均在原水平触发圆内：`0.707107 + 0.595 ≈ 1.302107 < 1.35`，余量约 0.047893 米，避免玩家走到标记处却未进入触发区域。
- 环底高度 `3.46 - 0.045 = 3.415`，比 `y = 3.4` 路面高 0.015 米；没有启用置顶显示。
- 已对每个圆环外缘取 7200 个角度样本，全部处于原 Track surface 盒体投影并集内；同时用上述凹角距离校验间距。GLB 实际倒角、文字与护栏固定件的可见交接仍须 CODE-02 配套画面验证。

CODE-02 在配置写入后才送达“先拍 before 再改配置”的同步消息。已立即告知可能触发 HMR，未为拍照回滚配置。代码侧随后通过独立测试 origin 5181 的代理响应加载其任务前快照，补拍修复前画面；[round-02-diagnosis.md](/Users/zhongjijie/study/球球大作战/marble-lab/docs/integration/round-02-diagnosis.md)已交付，确认的几何根因与以上一致。

## 护栏与窄桥标线

六个实体护栏的基础材质统一为现有 `orange`。两个 `Bridge rail`（中心 `[3.5, 3.53, 3.45]` 与 `[3.5, 3.53, 6.55]`）从 `blue` 改为 `orange`；起点与转弯四个护栏原本即为 orange。所有护栏的位置、尺寸、`body: 'static'` 和 `refinedVisual` 均不改，活动平台仍蓝色。

移除两条 `Bridge edge stripe` 连续装饰：原 X 为 `-1.94 / -0.06`，Y=3.414，Z=0.5，尺寸 `[0.07, 0.025, 7.8]`。

唯一断续警示来源改为八个 `Bridge edge dash`：

- X：`-1.89`、`-0.11`，每侧四段。
- Z：`-1.8`、`0`、`1.8`、`3.6`。
- Y：`3.413`；尺寸：`[0.12, 0.008, 0.7]`；材质：`orange`。
- 不设置 `body`，不设置 `refinedVisual`，在精细模型和基础回退时均由配置显示；不是实体护栏。
- 每段长 0.7 米，相邻段净空 1.1 米；8 毫米厚，底面距基础路面 9 毫米。X 外缘距窄桥盒体边界 0.1 米，段落均落在原台面内。

ART-02 新静态 GLB 已按交付报告移除原八个 `Narrow caution dash`（X=-1.89/-0.11，Z=-1.8/0/1.8/3.6）的烘焙显示；未添加同位置替代标线，未烘焙运行时圆环。原生成脚本不作玩法来源，未通过重跑旧生成器覆盖旧资源。

先前“新配置 + 旧模型”的混合阶段已在切换引用后结束。新静态模型采用统一橙色实体护栏并整理交点网格；配置提供唯一窄桥断续线。最终实际游戏中的端部、圆环与基础回退表现仍由 CODE-02 核验。

## 保护项与验证

[display-audit.json](/Users/zhongjijie/study/球球大作战/marble-lab/docs/levels/round-02-evidence/display-audit.json)记录实际数值、覆盖检查及版本哈希。

可在项目根目录重复执行 `node docs/levels/round-02-evidence/audit.mjs`，从当前配置与修改前 JSON 检查保护字段、碰撞数量、圆环支撑范围和标线无碰撞约束；脚本只读取文件，不改变配置。冻结版与最终引用版均已执行通过，最终结果见 [final-audit.json](/Users/zhongjijie/study/球球大作战/marble-lab/docs/levels/round-02-evidence/final-audit.json)。

- 对比解析前后数据：去除本轮 ring、标线和护栏显示材质差异后，其余数据完全一致。静态碰撞仍为 15 项，数量、名称、类型、位置、尺寸和 body 不变。
- 起点及预览位置、真实检查点位置与顺序、触发容差、终点判定、掉落线、摆锤/平台全部参数和 progress 未变；没有改运行时、控制、物理、镜头、状态、奖牌、存储或成绩。
- 最终引用版 `npm test`：6/6 通过，0 失败，见 [final-npm-test.log](/Users/zhongjijie/study/球球大作战/marble-lab/docs/levels/round-02-evidence/final-npm-test.log)。
- 最终引用版 `npm run build`：类型检查及生产构建通过，见 [final-npm-build.log](/Users/zhongjijie/study/球球大作战/marble-lab/docs/levels/round-02-evidence/final-npm-build.log)；保留既有大包提示，构建通过不代表游戏内视觉验收。
- 未操作共享浏览器；配套新 GLB 的成功加载、基础回退、两个圆环未触发/已触发状态、护栏全部交接以及检查点 2 掉落重生，交 CODE-02 验证。

## 下游交接与剩余项

1. ART-02 已依据冻结配置交付新静态资源，见 [round-02-delivery.md](/Users/zhongjijie/study/球球大作战/marble-lab/docs/art/round-02-delivery.md)。关卡侧已核对文件哈希、GLB 头/长度、自包含性、节点和资源统计：`TrackStatic`、33,363 三角面、6 材质、623,408 字节。
2. 新静态 GLB SHA-256：`2f28e781b243d40e00807ebc1d17fc0ff193f294c445b7e859bf1d448b7198a6`；原平台 SHA-256：`8ea7ca31229e21f21ddfb57f88308362e9f0944dc2d0334aab1485586fb6ca12`，与交付报告一致。
3. LEVEL-02 切引用前确认当前源文件逐字等于冻结版本，只改 `visuals.track`；最终保护审计、测试、构建通过，已向代码/美术/统筹回传版本与哈希。
4. CODE-02 针对配套完成版本执行最终技术验收，用户在原本地地址检查效果；产品统筹汇总验收。

LEVEL-02 交付已完成；剩余为 CODE-02 游戏内对比、基础回退、检查点 2 掉落重生及原玩法/存储回归，最终状态以代码验证报告和产品验收为准。没有新增玩法能力或需要用户重复授权的事项。
