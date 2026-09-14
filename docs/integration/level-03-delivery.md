# 第三关与13类图鉴 · 代码交付

2026-09-14。状态：**代码与资源接入完成，未经本轮测试、构建、类型检查或浏览器试玩**。按用户要求不执行上述验证、不git add/commit/push、不部署。本文是实现交接，不是技术或产品验收报告。

后续已完成intense-v2接入，保留standard/challenge/intense历史桶；代码已让图鉴读取正式参数。下文standard与资产/配置SHA记录初次交付快照，当前杆碰撞、长窄板与45°吊桥见 [intense-v2交付](level-03-refinements.md)，前两轮结果见intense与challenge说明。不要将初版哈希用作当前资产或配置校验值。

## 已交付行为

- 图鉴入口 `/#/obstacles` 收录13类。桌面三列卡片，每张保留名字和模型；点击后放大为独立3D预览，只保留名字、模型和播放/暂停、重播、旋转/缩放、恢复视角控制。新增五张卡使用本地静态PNG，卡片不常驻WebGL。
- 共享库整包加载/解析与模板构建在同一Application内复用；按唯一根名和严格父子路径克隆目标机关，只显示选中子树。关闭弹窗释放实例并停止动画/连续渲染，离开图鉴释放模板、资源池、Application及监听。图鉴不启用Ammo，不写成绩；跷跷板动画只为姿态示意。
- 第三关已从 `src/levels/mechanism-trial.ts` 导入并注册为03“机关试炼”，规则standard，无奖牌阈值。现有首页选关和纪录页读取同一目录，继续使用v3关卡/规则桶；注册没有迁移或清空浏览器数据。
- 路线按正式配置依次使用推墙、翻板、跷跷板、滚筒、吊桥，包含三处检查点。第三关只有静态track外观，没有旧platform；运行时与加载器支持省略旧平台。
- 跷跷板创建真实动态板和固定世界的单X轴铰链，以实际接触承受球负载；弹簧阻尼只对板施加扭矩。其他四种使用真实运动学主体：滚筒绕Z旋转、推墙五阶段往复、翻板绕偏心侧轴开闭、吊桥围绕上轴同步平移与倾转。没有用图鉴正弦角度替代游戏跷跷板，也没有额外推球力或填洞托板。
- 主体尺寸/枢轴来自共享manifest，固定及随动吊架碰撞来自LEVEL明确配置；GLB只作Render。模型失败时保留基础外观与碰撞。重开复位机关，普通掉落不重置跷跷板；暂停不推进机关时钟和恢复力。
- 新机关构造失败时清理已创建约束、实体和库资源；取消加载先销毁共享库实例/模板，再取消资源池，迟到实例丢弃。退出场景释放约束后再销毁动态体。

## 文件与职责

代码维护：

- `src/game/levels.ts`：03目录注册。
- `src/game/level-types.ts`、`library-types.ts`：可选平台和五机关配置类型。
- `src/game/library-data.ts`：共享manifest、主体枢轴与阶段姿态。
- `src/game/obstacle-library.ts`、`library-visuals.ts`：模板克隆、分件寻址、轴心动画与基础外观。
- `src/game/library-mechanisms.ts`、`runtime.ts`、`track-visuals.ts`：真实刚体、铰链、生命周期和第三关接入。
- `src/game/obstacles.ts`、`obstacle-scene.ts`、`obstacle-preview.ts`：13类目录、预览场景和独立Application。
- `src/components/Obstacles.vue`、`ObstaclePreview.vue`、`LevelThumbnail.vue`、`src/assets/obstacles/`：图鉴、预览宿主和第三关局部缩略图。
- `tests/library-motion.test.mjs`：推墙阶段、翻板预告/偏心开口、滚筒轴角、吊桥悬挂半径、跷跷板角度不受时间驱动的用例；**已编写，未执行**，不覆盖Ammo真实动力或通关。
- `README.md`、`AGENTS.md`、`docs/COLLABORATION.md`及图鉴/库/第三关接入说明：当前能力与边界。

LEVEL交付 `src/levels/mechanism-trial.ts` 和 `docs/levels/`；ART交付 `art/`、`public/models/`及 `docs/art/`。代码任务没有重写这两方文件或运行模型生成器。库manifest中的runtimeSupported/design.implemented保持资产制作时记录，实际实现状态记在代码目录和本说明，不把预览能力当作动力验收。

## 已收到的资源交付标识

以下SHA-256引用LEVEL/ART交付记录，本轮没有另跑校验命令：

- 正式配置 `src/levels/mechanism-trial.ts`：`9cc37be109d846a81410ce91ac15d105af176a122c4d0eef4b291342681f60bb`。
- 静态轨道 `public/models/mechanism-trial-track.glb`：`b115eb499234546aa92c8b1a18c7c04957a802e0ed5e7d9b86821b3166fabda3`，ART报告750,280字节、40,384三角面、5材质。
- 共享库 `public/models/obstacle-library.glb`：`b4676ab48024f7f579ecc0ff9177076021d7098477716df07f8af46a04ef57b7`，ART报告551,416字节、31,860三角面、18mesh、6材质。
- 第三关源文件 `art/mechanism-trial.blend`：`ea0b0dc7dc67bf5a12e4199e05278f6ff4ea82f0baddbc122599f393b7505e85`。
- 共享库源文件 `art/obstacle-library.blend`：`e27970391f9a72d3a0e8830a85063aae82a6e703d3fffc162986da55dea8de37`。

全部米制、glTF Y-up。TrackStatic为世界原点identity；五机关根Y0、参考岸顶Y3.4，按各实例position/yaw放置，动件保持清单枢轴，不从整库包围盒生成碰撞。详情见 [第三关美术交付](../art/mechanism-trial-delivery.md) 与 [共享库交付](../art/obstacle-library-delivery.md)。

ART同期已原位修复第二关白台面缺面，同名 `water-rush-track.glb` 交付SHA为 `3c1698f1671cc0428a93b5bea0c865858b0fe3a2fec4e0f9d44ee64b368a0221`。配置继续引用该文件名，重新加载同名资源即可取用；代码没有添加第二关几何补丁，未验证实际显示。

## 未验证边界与后续验收

尚未运行类型检查或构建，因此不能保证当前整体编译通过；新测试也没有通过结果。尚未在浏览器观察13卡布局、模型轴心、图标交互、关闭/重开/切换时资源表现或减少动态设置。本轮未启动或操作预览服务。

第三关真实铰链稳定性、负载翻转、滚筒切向接触、推墙碰撞与预告、翻板全开掉落、吊桥接触带动、全行程干涉、各接缝通行、CP重生/终点及手机体验均未验。静态制作图和图鉴动画不能替代这些证据，也没有金银铜校准或通关成绩。

后续获准验证时统一使用现有 `npm test`、`npm run build` 入口，再由代码任务独占浏览器完成接入/物理验证；产品统筹结合用户实际体验验收。当前不自动执行。旧玩家力、质量、摩擦、刹车、速度限制、重力、镜头及现有设置/成绩保持；没有自动关卡推荐、可视化搭关卡或PlayCanvas Editor导入。
