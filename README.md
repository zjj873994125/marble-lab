# 滚动实验室 · 本地首版

Vue 3 + TypeScript + Vite + Element Plus + Less 负责页面，PlayCanvas 2.22.1 + Ammo WebAssembly 负责真实 3D 与刚体物理。

## 运行

建议 Node.js 22 LTS；本次环境使用 Node.js 18.19.0 / npm 10.2.3 验证。

```bash
npm ci
npm run dev
```

打开终端给出的本地地址。生产检查及预览：

```bash
npm run build
npm test
npm run preview
```

构建输出在 `dist/`，可部署到普通静态网站托管。使用 Hash 路由与相对资源路径，支持部署到子目录。运行时物理文件包含在项目内，不需要 PlayCanvas 账号或外部 CDN。

## 当前功能

- Vue 主界面、关卡入口、本地纪录页、操作说明。
- Element Plus 设置抽屉、画质切换、音效音量、控制灵敏度、减少动态效果。
- 教学关卡：开放的玩具锤路段、窄桥、左右横移并完整让空的平台、两个检查点和终点。
- 第二关“水上冲关”已接入本地选关、三圆弧锤、十字旋转台、四升降板及惯性坡；旧standard已真实通关，challenge调难及S弯配套仍待新一轮验收。
- WASD / 方向键移动，空格刹车，R 重开，Esc 暂停或继续。
- 掉落从最近检查点重生，计时继续；切换标签页或失去窗口焦点自动暂停。
- 完赛结算、目标奖牌、每关每种玩法最快 20 次成绩；新版与旧版分开比较，旧纪录和设置保留。
- 深蓝绿色水面与轻量水纹；低画质和减少动态时使用静态水纹，水池不参与碰撞或重生判定。

当前定位为验证 Vue 与游戏运行时配合的可玩首版。轨道外观已接入 Blender 制作的 GLB：连续倒角、分层底座、护栏固定件、拼缝、螺栓、支撑脚与移动平台。显示模型与碰撞代理分离。第三轮按授权移除摆锤段两栏及碰撞，平台沿 X 轴扩大行程，玩具锤使用匹配的 Z 向平端圆柱代理；弹珠手感、重力、镜头和真实检查点保持。尚未接入 PlayCanvas 在线编辑器。金银铜用时为初始目标，需进一步试玩校准。界面适配窄屏，游戏目前需要实体键盘，尚未实现触屏操控。

此前胶囊版验证：12 项测试与生产构建通过；第三轮原版实际全路线 32.83 秒、掉落 2 次、金牌，已验证锤击出界、平台两个周期完整露空、露空掉落后检查点二重生、返回登离台、成绩分桶与刷新保留，以及资源失败回退和水池画质模式。平端与收栏修正需以同一报告中的追加验收为准，不能套用旧结果。证据与适用边界见 [第三轮技术验收](docs/integration/round-03-validation.md)。用时含工具暂停和刻意失败，不作为奖牌阈值校准。Safari、触屏和长期性能尚未验证；既有引擎/组件库大包提示保留。

## 文件分工

- 四个对话开始前先读 [项目规则](AGENTS.md) 与 [协作约定](docs/COLLABORATION.md)：包含产品统筹/代码/关卡/建模分工、配置字段、模型坐标和交付验证规则。
- `docs/product/round-03.md`：产品与统筹维护的当前需求入口；代码提供技术验证证据，统筹结合用户体验完成产品验收。
- `docs/integration/round-03-contract.md`：当前版本、平台、水材质与玩具锤接入协议；第一、二轮报告和截图继续保留。
- `src/levels/initial-gravity.ts`：关卡对话维护的位置、尺寸、碰撞代理、检查点、机关参数、进度分段和模型引用。
- `src/game/level-types.ts`：代码对话维护的关卡配置类型。
- `src/App.vue`：应用壳、游戏 HUD、暂停与结算。
- `src/components/Lobby.vue`：首页与关卡入口。
- `src/components/Records.vue`：本地成绩。
- `src/components/SettingsPanel.vue`：Element Plus 设置界面。
- `src/components/GameCanvas.vue`：挂载、释放 PlayCanvas；连接 Vue 状态。
- `src/game/runtime.ts`：读取关卡配置创建实体，管理物理、输入、音效、摄像机。
- `src/game/track-visuals.ts`：精细轨道模型加载及基础外观回退。
- `src/game/hammer-visuals.ts`：独立锤头/柄 GLB 加载、平端圆柱基础外观和失败回退。
- `src/game/water-material.ts`：本地水纹材质，不生成池体几何。
- `art/track-round-03.blend`、`art/hammer-toy-round-03.blend`：当前可编辑轨道与玩具锤。
- `art/build_track.py`：旧初版生成脚本，仅作历史参考，不用于覆盖当前资源。
- `public/models/`：静态轨道与移动平台的 GLB。
- `src/state.ts`：游戏状态与 `marble-lab-v3` 按关卡/规则分桶保存；v1/v2 均只读保留原文。
- `src/game/levels.ts`：本地关卡目录，`src/levels/water-rush.ts` 为第二关正式配置。第二关当前证据与未完成项见 [技术验证](docs/integration/level-02-validation.md)。

### 轨道外观资源

关卡配置与运行时代码已分离。当前为本地双关，场景布局通过配置传给运行时。精细 GLB 仍是整关模型，布局变化不会自动更新外观；可将配置的 `visuals` 设为 `null`，用基础几何体验证碰撞。Blender 生成脚本尚未自动读取关卡配置。

当前静态 `track-round-03.glb`：30,615 三角面 / 6 材质 / 573,320 字节；继续使用原 `platform-refined.glb`。玩具锤采用 `hammer-head-toy-round-03.glb` 与 `hammer-handle-toy-round-03.glb`，与 [.9,.9,1.36] 的 Z 向平端圆柱主体匹配。完整资源统计、原点与哈希见 [ART-03 交付](docs/art/round-03-delivery.md)。

模型采用米制、glTF Y-up。旧 .blend、旧 GLB、旧生成器及问题证据都保留；不要重跑 `art/build_track.py` 恢复旧布局。用户最新要求直接修改当前模型文件和同名 GLB，不再另建版本或备份；仍先核对用户手动编辑，按当前协作协议操作。

## PlayCanvas 编辑器衔接

用户已确认先做本地版本，未创建或发布云端项目。

正式接入时，保留 Vue 页面与组件：

1. 在 Editor 制作轨道 Template，为其配置显示模型、简化碰撞体和机关属性。
2. 创建关卡，使用明确命名/标签标记 Player、Start、Checkpoint、Finish。
3. 导出项目资源与场景，将当前运行时中的程序化搭建部分替换为 Editor 导出场景加载；按该导出版本处理脚本和资产清单。
4. 保留 `start / setPhase / applySettings / destroy` 以及 `tick / finish / pause / restart` 交互边界。Vue 不直接改引擎实体。

Editor 项目实际导入与加载需要基于真实导出包验证，当前不宣称已支持任意 Editor 导出项目即插即用。

## 资源与限制

`public/vendor/ammo.wasm.js` 和 `ammo.wasm.wasm` 来自 PlayCanvas 官方 engine 仓库 `examples/assets/wasm/ammo/`，下载于 2026-09-10。来源与许可见同目录 `NOTICE.md`。PlayCanvas 与 Element Plus 等 npm 依赖许可保留在依赖包内。

没有服务端账号、在线排行榜、多人游戏、云端存档或收费功能。清除网站数据将删除当前浏览器的设置与纪录。
