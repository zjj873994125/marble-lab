# CODE-02 · 阶段验证与第三轮交接

日期：2026-09-11。**状态：显示修复已配套，技术验收部分完成；按统筹最新指令停止继续旧玩法全路线测试，剩余视觉及玩法回归合入第三轮。不得标记为 CODE-02 全部验收通过。**

需求与诊断：[第二轮任务](../product/round-02.md)、[round-02-diagnosis.md](round-02-diagnosis.md)。用户后来明确追加移除摆锤段两栏及碰撞、扩大平台行程、换真实锤子模型；这些是第三轮指定变更，不沿用第二轮对这些点的冻结结论。其余护栏、窄桥唯一标线和检查点圆环修复目标继续保留。

## 配套版本与本对话改动

- LEVEL-02 最终配置：`src/levels/initial-gravity.ts`，SHA-256 `42d3d338b8bd6ecf8e8eb537fd194028f23b7f5310f4611a2af0a7829bb3abcf`。
- ART-02 新静态：`public/models/track-round-02.glb`，SHA-256 `2f28e781b243d40e00807ebc1d17fc0ff193f294c445b7e859bf1d448b7198a6`；33,363 三角面、6 材质、623,408 字节。引用已切换；平台仍为 `platform-refined.glb`。
- CODE-02 新增 `tests/level-visual.test.mjs`，以实际 PlayCanvas TorusGeometry 网格检查两个检查点圆环的台面覆盖、倒角间距和触发区域对应；无需修改运行时、配置类型或显示架构。
- 运行时、控制、镜头、状态/存储与旧模型、旧脚本均未修改。本次读取并验证关卡与美术交付，不代改其文件。

## 已完成验证

- **通过｜最终配套版本测试**：`npm test` 7/7，见 [npm-test.log](round-02-evidence/npm-test.log)。
- **通过｜最终配套版本类型检查/构建**：`npm run build` 退出 0，见 [npm-build.log](round-02-evidence/npm-build.log)。保留既有 UI/引擎大包警告，没有本轮新增构建错误。
- **通过｜缺角回归信号**：新测试读取原配置快照时失败，读取修复配置时通过，见 [旧版失败](round-02-evidence/ring-regression-before.log) / [修复版通过](round-02-evidence/ring-regression-after.log)。快照保存在 [before-level.ts](round-02-evidence/before-level.ts)，未为测试回滚共享配置。
- **通过｜模型接入**：浏览器读到 `visuals.track='track-round-02.glb'`，存在 `Detailed track visuals`，基础轨道 Render 隐藏。日志入口为 `runtime-trace.json` 的 `final-model-loaded`。
- **通过｜当前可见显示结果**：实体护栏已统一橙色；唯一真正相交的两段护栏接头显示表面连续，短端按原碰撞并集保留；窄桥只有八段配置标线，均可见且无碰撞。ART 独立资源验证证明旧烘焙标线已移除，详见 [asset-verification.log](round-02-evidence/asset-verification.log) 和 ART-02 交付。
- **通过｜两个未触发圆环**：两环均完整落在 L 形台面内，与真实触发区域对应；未改深度测试、未置顶。使用与 before 相同的诊断机位拍摄。
- **通过｜检查点一已触发圆环**：真实经过检查点一后变为橙色；球离开后近景仍完整，无缺角穿插。[已触发画面](round-02-evidence/after-checkpoint-1-triggered.jpg)。
- **通过｜已执行的正常镜头片段**：开局、直道移动和制动、摆锤路段、检查点一触发、窄桥行驶及暂停/继续均有正常跟随镜头证据。`straight-corner` 的北向速度约从 7 降至 0.041，当前参数未变。
- **通过｜第二轮保护项审计**：仅排除获准的两处 ring、Bridge rail 基础材质、八段警示线与静态模型引用后，其余配置完整深比较一致；15 个静态碰撞对象及机关数据不变。[配置审计](round-02-evidence/protected-config-audit.json)。受保护的代码和旧资产哈希也一致，[源文件审计](round-02-evidence/protected-source-audit.json)。此审计仅证明第二轮版本，不约束第三轮已明确允许的碰撞与平台行程变更。
- **通过｜原数据保护**：本轮使用独立测试 origin 5179，原用户 5173/Chrome 数据未写入。测试 origin 仍保留 CODE-01 的 57.24 秒成绩及原设置，第二轮尚未完赛，没有生成新成绩。

## 保留的 before / after 证据

证据目录：[round-02-evidence](round-02-evidence/)。用户原图仍保留在产品目录，由统筹维护。

- 护栏样式：[before](round-02-evidence/before-rail-overview.jpg) / [after](round-02-evidence/after-rail-overview.jpg)。
- 原十字交接：[before](round-02-evidence/before-rail-junction.jpg) / [after](round-02-evidence/after-rail-junction.jpg)。
- 检查点一未触发：[before](round-02-evidence/before-checkpoint-1.jpg) / [after](round-02-evidence/after-checkpoint-1-untriggered.jpg)。
- 检查点二未触发：[before](round-02-evidence/before-checkpoint-2.jpg) / [after](round-02-evidence/after-checkpoint-2-untriggered.jpg)。
- 正常镜头：[起点/摆锤前](round-02-evidence/route-start-rails.jpg)、[检查点一](round-02-evidence/route-checkpoint-1.jpg)、[窄桥](round-02-evidence/route-narrow-bridge.jpg)。
- 过程数据：[runtime-trace.json](round-02-evidence/runtime-trace.json)，含键盘事件、时间、坐标、速度、检查点、标线和成绩采样。

前四组对比都是 1280×720、相同视角；近景临时设置渲染相机，仅作视觉诊断，拍完移除回调。之后应用窗口被调整，部分正常镜头/已触发截图为 789×964，不能与前组进行逐像素对比。没有改变代码中的跟随镜头参数。全部路线片段只通过原有键盘处理器驱动 Ammo，未瞬移、未修改物理/计时/检查点状态。

原配置已在其他对话先行修改，before 因此通过独立 5181 测试代理加载任务前快照获得，其他运行时和旧模型保持原样。最初混合阶段的无效截图已被正确旧版图替换，没有把新配置旧 GLB 标成 before。机位见 [comparison-views.json](round-02-evidence/comparison-views.json)。

## 未验收完成，必须合入第三轮

- [ ] 新模型加载失败时，基础回退中的护栏交接、橙色材质和唯一窄桥标线；现有单测已过，浏览器尚未注入资源失败。
- [ ] 检查点二真实触发后的橙色圆环近景，以及该检查点掉落重生。
- [ ] 第三轮最终版本正常跟随镜头和必要近景的所有剩余护栏端部、两个圆环、起点/终点同类显示检查。
- [ ] 第三轮最终版本完整路线、摆锤撞出、新平台行程、锤子、终点结算及成绩版本隔离后的刷新恢复。
- [ ] 针对第三轮明确允许的差异重新建立保护项审计：移除指定两栏及碰撞、平台参数、成绩版本兼容、锤子显示，其他字段按正式任务保护。

停止时 `paused-for-round-03`：检查点 1/2、掉落 4、计时约 17.091 秒，球在窄桥中段；没有完成第二轮全路线，不能引用 CODE-01 的完整通关当成本轮结果。`route-checkpoint-2.jpg` 与日志中早期 `checkpoint-two` 标签来自一次未成功到达检查点二的操作尝试，不是检查点二通过证据；以后以 HUD 与实际 `checkpoint` 值为准。

## 运行观察与边界

窄桥出口首次制动过晚，球从原有 L 形缺角跌落。检查点一重生后停留在真实内凹角附近，本次还观察到细小侧向漂移并再次滑落：`checkpoint-one-respawn-before-brake` 约 `[-.925,3.815,-4.075]`，之后约 `[-.553,3.229,-4.447]`。这些位置和物理逻辑均未因第二轮显示修复改变；目前只记录现象，不宣称已查明所有动态原因，也不擅自移动真实重生点。按统筹停止旧玩法重复回归，第三轮应保留该观察供判断。

并行配置 HMR 阶段曾出现 `Cannot read properties of null (reading 'append')`；完整刷新后正常加载。还遇到浏览器诊断所用 Vite 依赖查询版本变化，重新选择实际已加载的引擎模块后采样正常；这是诊断连接问题，不是游戏实体缺失。

原 Marble Lab Vite PID 54748 在验证期间消失，5173 一度由另一项目的 IPv6 服务响应。核对后仅重新启动本项目 `npm run dev -- --strictPort`，当前本项目 PID 31654 绑定 `127.0.0.1:5173`，其他项目服务未操作。最终冷加载/图片均核验来自本项目。测试标签页已关闭，输入与诊断相机回调已清理；不把临时测试地址当用户发布地址。

## 第三轮独立预查：尚未实现

**存档依赖**：现有 `marble-lab-v1` 同时保存 `settings` 和无版本的 `runs`；读入、20 条裁剪、排序和写回集中在 `src/state.ts`。`Lobby.vue` 直接用 `state.runs[0]` 作最佳成绩，`Records.vue` 展示整个列表，`App.vue` 调用 `medal()` 显示结算，`GameCanvas.vue` 把终点回调接到 `finishRun()`；现有存储测试在 `tests/state.test.mjs`。新玩法启用前必须先兼容旧纪录和设置，覆盖所有这些读取点，不能只给写入增加字段。

最小实现方向待正式字段定稿：给成绩标识明确的玩法版本，将无版本旧记录归为旧版，当前最佳/排序仅比较当前版本，旧纪录继续可查看；保留设置，迁移可重复执行且失败时不损失原数据。持久化格式、版本标识和最终展示以第三轮正式任务为准，本次未改任何存储代码。

**锤子接入**：当前 `Pendulum` 球实体与 `Pendulum arm` 杆实体分别生成，头部按位置轨迹移动，杆按 anchor→头部的方向和距离旋转/伸缩；现有 GLB 加载器只接收静态轨道与平台。真实锤头/锤柄不能当成静态整关模型随意烘焙。正式交接需给出头/柄节点名、原点、局部轴、米制尺寸，以及柄长是否由运行时适配；代码统一加载并管理释放，模型只挂显示层。锤头碰撞是否沿用当前简化球代理必须按第三轮明确约定处理，不依据“换模型”自行改变碰撞形状。

CODE-02 当前为阶段交付与待合并验收，不再追加针对旧玩法的路线测试；等待第三轮正式任务和字段交接。
