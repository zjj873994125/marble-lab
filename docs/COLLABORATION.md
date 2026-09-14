# 四个对话的协作约定

本约定对应 2026-09-11 的本地版本。目标是在同一个项目中分开维护产品统筹、代码、模型和关卡，避免共享运行时文件被互相覆盖。四个对话开始工作前均需阅读本文件与根目录 `AGENTS.md`。

当前统一需求入口为 [第三轮任务](product/round-03.md)，前两轮任务与证据继续保留。产品与统筹负责汇总需求和任务状态；执行对话仅更新各自交付。

## 文件分工

- **产品与统筹对话**：维护 `docs/product/`，负责目标、优先级、任务分派、跨职责依赖和产品验收；不代改代码、关卡或模型。用户体验需求由此汇总，实施范围以已明确分派的任务为准。
- **代码对话**：维护 `src/game/`、`src/App.vue`、其他 Vue 页面、`src/state.ts`、测试、构建配置、README、本约定、AGENTS 和 `docs/integration/`。负责 PlayCanvas 实体创建、物理与输入、生命周期、模型加载、配置类型及最终接入验证。
- **关卡对话**：维护 `src/levels/` 的正式关卡数据，关卡设计说明放在 `docs/levels/`。负责位置、尺寸、碰撞代理布局、检查点顺序、终点、掉落线、已有机关参数和进度分段；不编辑 `runtime.ts`、加载器、Vue 或模型源文件。
- **建模对话**：维护 `art/`、`public/models/`，美术交付说明放在 `docs/art/`。负责 Blender 场景、材质、倒角与机械细节、GLB 导出和资源报告；读取关卡配置对齐模型，不修改关卡碰撞数据、运行时代码或物理参数。

关卡数据已完成独立抽取，`src/levels/` 的日常编辑由关卡对话负责。其他对话需要新增字段或玩法时，先交付具体需求和示例，由代码对话调整类型、实现和测试，再填写配置。公共文件由代码对话统一维护。

当前目录已有 Git 历史；检查暂存区及未暂存内容，保留用户和其他任务的并行修改。每次编辑前读取最新文件，在内存中记录内容或校验值，写入前再核对，不生成额外文件备份；发现用户或其他对话已修改相同内容，先说明原因及拟修改范围并获得用户确认。不要全文件格式化、批量修复或复制旧项目覆盖当前文件。

## 当前关卡数据格式

数据入口为 `src/levels/initial-gravity.ts`，类型定义为 `src/game/level-types.ts`。使用普通 TypeScript 对象、数组和数值，允许简单坐标算术；不导入 Vue 或 PlayCanvas，不创建实体，不写回调、存储或资源请求。类型导入不产生运行时代码。

运行时和 HUD 读取同一份配置。当前已注册“教学关卡”“水上冲关”和“机关试炼”，目录由代码维护于 `src/game/levels.ts`；单独增加配置文件不会自动注册。第一关 `rulesVersion` 为 classic/open-hammer/flat-hammer（省略为classic），第二关区分standard/challenge/serpentine，第三关mechanism-trial当前为intense-v2、保留standard/challenge/intense历史桶、暂无奖牌阈值。第三关已开发，尚未测试、构建或试玩。`marble-lab-v3` 按关卡和规则分桶，v1/v2原文只读保留，旧成绩不参与新难度最佳。后续改变真实规则仍需先确认版本归属，不能清空记录。

首页左侧合并开始/继续与选关，旧 `/#/levels` 跳回首页并打开选关。v3的lastStartedLevelId/hasPlayedBeyondFirst只在有效startRun时记入，旧成绩可用于迁移，预览选择不算游玩。继续表示新开上次实际开始的关卡，显式选关优先，不伪造跨刷新局内续玩；详见 [首页入口说明](integration/home-level-entry.md)。

- `staticObjects`：完整的静态场景和基础外观，每项包含 `name`、`type`、`position`、`size`、`material`。`name` 是调试名称，可重复；不作为模型替换查找键。
- `body: 'static'`：创建静态碰撞代理；省略 `body` 的对象仅显示，没有碰撞。增加螺栓、拼缝等外观时不要增加 `body`。
- `refinedVisual: true`：该静态对象的外观已包含在整关 GLB 内，模型全部加载成功后只隐藏它的 Render；碰撞体持续有效。GLB 中没有对应外观的新对象不要标记此字段。
- `start.position`：开局和重生时弹珠中心；`previewPosition` 保留初次加载时的弹珠中心。两者当前分别为 `[-10, 3.95, 7]`、`[-10, 3.9, 7]`，是原实现的差异。
- `checkpoints`：按经过顺序排列；每项 `position` 同时用作检测中心和重生位置。`checkpointTrigger` 给出水平半径和垂直容差。增减检查点时同步调整 `progress`。
- `finish`：检测中心、水平半径、垂直容差和显示圆环。只有全部检查点按顺序通过后才能完赛。
- `ring`：独立的外观位置与半径，没有碰撞；其高度通常接近轨道表面，不能拿它替代弹珠中心高度。
- `fallY`：弹珠中心低于此世界坐标高度时重生，保留掉落计数与持续计时。
- `pendulum`：第一关保留一个沿 Z 方向运动的摆锤，`ball` 为当前玩具锤的 Z 向平端圆柱运动学代理（旧版球/胶囊成绩单独归档），`rod` 为独立锤柄，`anchor` 为杆上端。偏移为 `sin(time * angularSpeed) * amplitude`；Y 额外增加 `abs(偏移) * lift`；杆宽为 `rodWidth`。
- `platform`：可选的一个盒形运动学平台，`axis` 选择 x/z（省略 z）；第一关当前 x=8+3.4sin(1.25t)、z=-.35，模型和 stripe 同步。centerX 默认 body.position[0]，Y 来自 body.position，条纹 Y 来自 stripeY。角频率为弧度/秒、振幅为米；时间从开局累计，暂停不推进。
- `mechanisms`：可选的共享库五机关实例数组，根position/yaw与具体机关参数由LEVEL填写；主体尺寸/枢轴读取共享manifest，staticColliders与frameColliders只使用明确分件代理。跷跷板为动态单铰链，其余为运动学刚体，见 [第三关接口](integration/level-03-contract.md)。图鉴预置姿态不是游戏负载响应。
- `progress`：第 n 项对应已通过 n 个检查点。公式为 `base + clamp((z - originZ) * direction / divisor, 0, max)`；`direction` 为 `-1` 或 `1`，`divisor > 0`。必须有“检查点数量 + 1”项；每项 `base + max <= 1`，完赛时设为 1。第一关默认沿Z；第二关可用axis=x/z和origin，仍不是自动测算路径长度。

支持的基础材质键为 `cream`、`edge`、`orange`、`dark`、`blue`、`floorMat`、`water`、`poolEdge`。材质具体参数由代码对话维护；GLB 的 PBR 材质由建模对话维护。球体质量、重力、步长、摩擦、控制力度、刹车、速度上限和镜头仍由代码对话管理，本次没有改动。

## 模型与碰撞代理

统一以米为单位，PlayCanvas / glTF 为 Y-up，位置写作 `[x, y, z]`，尺寸为完整的宽、高、深，不是半尺寸。Blender 使用 Z-up，游戏坐标 `(x, y, z)` 在 Blender 中对应 `(x, -z, y)`。当前轨道行驶面为世界坐标 `y = 3.4`。

- `public/models/track-round-03.glb`（旧版资源保留）：整关静态外观，导出网格名称 `TrackStatic`；坐标包含整条轨道的世界位置，原点为 `[0, 0, 0]`，运行时直接挂到场景根节点，不再添加位置、旋转或缩放。
- `public/models/platform-refined.glb`：移动平台外观，导出网格名称 `PlatformVisual`；原点是原平台刚体中心，局部尺寸为 `3 × 0.36 × 2.9` 米，不能把世界位置烘焙到平台模型里。
- 当前 Blender 源文件为 `art/track-round-03.blend`、`art/hammer-toy-round-03.blend`，具体脚本以 ART-03 交付为准。旧 `art/build_track.py` 仅为历史参考。导出前应用对象变换，GLB 不包含灯光、摄像机或玩法脚本；保持自包含，纹理如有新增必须嵌入 GLB。
- 运行时仅实例化 GLB 的 Render。轨道和护栏使用轴对齐盒形代理，半尺寸由运行时按 `size / 2` 生成；球形代理要求三个尺寸相等，半径为 `size[0] / 2`。cylinder 默认沿 Y，显式 collisionAxis:2 时显示和原生圆柱碰撞均沿局部 Z，size 为 [直径,直径,端面间总长]；当前锤头半径 .45、总长1.36。旧 capsule 语义保留用于兼容，不作为当前平端锤代理。
- 摆锤与平台的碰撞由运行时设为 `kinematic`；配置里的装饰杆、标识和导轨不增加碰撞。显示模型的倒角、螺栓、底座、支撑件不得改变碰撞边界。
- 平台显示模型挂在平台刚体实体下。父实体已有用于基础几何体的比例，加载器抵消该比例，确保 GLB 仍按米制显示。修改代理尺寸不会自动缩放 GLB，必须交接并检查外观与代理是否匹配。

独立玩具锤的 HammerHead / HammerHandle、原点、长度伸缩和成组失败回退见 [当前接入协议](integration/round-03-contract.md)。水池几何仅由 staticObjects 的六个无碰撞对象提供，运行时只提供水材质与轻量水纹，不在 GLB 再生成。

水材质使用本地512px周期法线、世界米制双层采样及水面专用柔和环境反射。独立视觉时钟在高画质菜单/游戏推进，暂停/结算/减少动态冻结，低画质为单层静态；不通过机关时间或timeScale驱动菜单水波。资源随关卡释放，本轮未做本地视觉验收，具体边界见 [水面说明](integration/water-surface.md)。

名称是模型交付与测试约定，加载器不按 GLB 节点名称搜索碰撞体。新增资源使用小写英文加连字符的 `.glb` 文件名，文件名更换由关卡对话更新 `visuals`，加载方式由代码对话维护。

## 资源加载与布局变更

`visuals.track` 指定静态轨道，`visuals.platform` 为旧移动平台的可选外观文件，均位于 `public/models/`。第三关仅填写track；五机关另由共享库加载器取用。运行时统一使用 `import.meta.env.BASE_URL + 'models/' + 文件名` 加载。不得在关卡数据或建模脚本中引入外部 CDN、账号、云端项目 URL 或新的加载器。

本关要求的轨道/平台GLB全部成功后，才隐藏标记的基础外观；任意一个加载失败会保留基础场景。共享库成功时只隐藏对应机关的基础Render，不移除真实碰撞；固定结构不能用整个Static包围盒生成碰撞。单个Application内模板和资产复用，退出时先释放约束、模型实例/模板，再释放资源池。

当前静态 GLB 是整关烘焙外观，**修改关卡配置不会自动重建 GLB**。关卡对话改变轨道布局时，先将 `visuals` 设为 `null`，使用基础外观验证真实碰撞和通关路径；待建模对话交付匹配模型并由代码对话完成接入验证，再恢复两个文件名。禁用精细外观不会禁用碰撞。

`art/build_track.py` 目前仍包含本关旧版美术布局，尚未自动读取 TypeScript 关卡配置；它不是玩法数据来源。运行时已读取独立配置，不再从脚本或 GLB 推断布局。后续将脚本改为自动消费共享数据属于单独任务，不能宣称已经实现。

生成脚本会覆盖 `.blend`、两份 GLB 与 `art/track-report.json`。运行前检查 Blender 当前场景是否有未保存修改、磁盘文件是否已被手工调整，并核对最近一次交付校验值。按照用户最新要求直接修改当前源文件与同名 GLB，不另存版本或创建备份；不能只看修改时间推断安全，发现具体手改冲突先说明，不能用旧脚本覆盖当前实现。

每次模型交付写在 `docs/art/` 的独立文件中，包含资源路径、对应关卡配置的 SHA-256、模型与源文件 SHA-256、单位、原点、尺寸、三角面和材质数量。关卡交付写在 `docs/levels/`，列出改变的数据、是否需要新模型、通关路线与待验证项。无需同时编辑公共说明。

## 统一验证与交付

技术验收由代码对话提供测试、构建、浏览器运行和模型接入证据；产品验收由统筹结合三方交付及用户的手感、审美判断完成。验证通过不代表提案自动获准开发。浏览器集成验证由代码对话统一安排并独占，关卡和美术使用其截图与运行结果补充提案，避免互相打断场景与存档。

在项目根目录执行：

```bash
npm test
npm run build
```

测试检查状态/持久化、配置数值与结构约束、本地 GLB 交付约定、模型替换及失败回退。构建包含 TypeScript 检查；这些检查不能证明物理手感和整条路线可玩。

代码对话统一进行浏览器接入验证，复用 `http://127.0.0.1:5177/`，确认服务工作目录是本项目。布局或模型变更还要检查：加载、外观与碰撞对齐、开局、刹车、暂停、重开、机关运动、按序检查点、掉落重生和终点结算。需要写入测试成绩时使用隔离测试浏览器，不清空或覆盖用户当前浏览器的设置与成绩。

当前三关通过独立配置加载；第二关三圆弧锤、五盒十字、四升降及旋转坡面的字段见 [第二关接入协议](integration/level-02-contract.md)，第三关五机关见 [第三关接入协议](integration/level-03-contract.md)，不是通用关卡编辑器。Vue 与运行时的 `start / setPhase / applySettings / destroy`、`tick / finish / pause / restart` 边界保留。本地选关与卸载已经实现，PlayCanvas Editor 场景导入仍未实现。

## 手机瞬时输入

`src/game/input.ts` 定义 GameInput（x/z/brake），App局部持有，通过GameCanvas hook进入原施力和刹车。输入不写存档；键盘方向优先，触控向量最多1，刹车取两来源实际按下状态。TouchControls分别捕获摇杆和踏板指针，暂停、旋屏、重开、切关及卸载清零。手机游戏使用精简横屏HUD，竖屏暂停，返回横屏需明确继续；小踏板仅显示图标，可点击区保留88px。

## 障碍物图鉴

皮肤统一从`/#/skins`商城装备，赛道七款与球九款使用独立v3字段trackTheme/ballSkin，类型和纹理作用域由CODE维护。ART只交设计/可用纹理，CODE复制到src/assets并接入；默认classic/steel恢复原PBR。球体UV贴图不能改变几何/碰撞或通过转环境伪造旋转，运动球用非金属及自身粗糙/法线。商城无付费/解锁，设置仅保留功能选项。具体见 [商城交付](integration/skin-shop.md)。

性能信息只按showPerformance显式开关采集主Application，按真实postrender与下一frameupdate统计配对、750ms汇总，不写指标到存档，不在图鉴/商城另开采集。生产版缺失详细三角面时显示“—”，不造数；纯净模式不会自动启用。见 [性能交付](integration/performance-overlay.md)。

赛道主题由代码维护`src/game/track-themes.ts`与`theme-materials.ts`，设置trackTheme保存在v3，七id为classic/industrial/glacier/black-gold/violet/pink/yellow，验证器和设置卡片直接读取统一目录。模型角色按实际语义名匹配，原始PBR基线按来源对象保存；Safety terracotta混有警示、Printed markings、Rubber pads及握柄保护。新资源交付需说明材质语义，不按原RGB猜用途。主题不改球/CP/警示、物理和关卡，也不重载场景。图鉴3D跟随主题，ART静态PNG保持经典示意；详细作用域和未验边界见 [主题交付](integration/track-themes.md)。

代码维护 `src/game/obstacles.ts` 的障碍资料和搭配关系；`/#/obstacles` 收录13类，以三列“名称＋模型”卡片和独立PlayCanvas预览呈现，弹窗只有名称、大预览及图标控制。图鉴不启动Ammo或挑战，不写成绩；静态结构的小球和跷跷板姿态均为示意，不能作为可通性证据。共享库在当前图鉴页复用模板，关闭弹窗释放实例，离页释放资源。新增机关先实现行为，再补图鉴类型/预览及推荐用途，不在关卡数据或GLB中混入UI代码。具体边界见 [图鉴说明](integration/obstacle-atlas.md)。
