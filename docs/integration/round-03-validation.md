# CODE-03 · 最终技术验收

日期：2026-09-11，Asia/Shanghai。状态：**本轮四项需求及 CODE-02 合并余项的技术验收完成，可交产品与用户验收。** 当前可在 `http://127.0.0.1:5173/` 刷新查看；没有发布云端。

## 结果

新版真实物理全路线完成：**32.83 秒、掉落 2 次、金牌**。第一次掉落来自玩具锤实际接触后的击出，第二次为主动在平台完全移开时驶入缺口；第二次正确回到检查点二，等待平台返回后实际跨过两条接缝、到达远岸并完赛。未通过瞬移、写位置、改速度或直接调用完赛生成证据。

该成绩包含工具暂停、相位观察和刻意失败，仅作流程验收，不能用来重标奖牌或宣称真人难度合适。原 35/55/90 秒奖牌阈值保留。

## 配套版本与文件

- 最终配置：`src/levels/initial-gravity.ts`，SHA-256 `3480c22cebe47818a3072859926ce4c650343d29deb94081f7f432f1d5378b95`，由 LEVEL-03 独占维护。
- 静态：`track-round-03.glb`，SHA-256 `002593fb6c622fbc601617db4f465f053077e158001f9feab720a01c5897a56a`。
- 玩具锤头：`hammer-head-toy-round-03.glb`，SHA-256 `230829a8897dceee6b2ec7f9d0f414466c54097ebce9629d32368487b950e399`。
- 玩具锤柄：`hammer-handle-toy-round-03.glb`，SHA-256 `3ec0b73b02fc079c6657165da3dc935195964a006caeaf7278427c11745bb5ad`。
- 原平台：`platform-refined.glb`，继续复用。旧资源与被否定的方盒锤证据保留，不作为当前引用。

代码交付包括 `src/state.ts` 的版本分桶、`Records.vue` 的旧纪录入口、`level-types.ts` 的版本/轴向/胶囊/资源/水材质字段、`runtime.ts` 的横移与匹配代理、`hammer-visuals.ts` 的成组加载/同形回退、`water-material.ts` 的本地纹理，以及必要测试。`GameCanvas.vue` 增加动态导入完成后的卸载检查，避免开发热更新时向空 host 追加 canvas。`App.vue` 与 Less 仅对水池场景的原文字区域加浅色底板，没有重做界面或镜头。

详细协议与资产边界见 [round-03-contract.md](round-03-contract.md)、[LEVEL-03 交接](../levels/round-03-handoff.md)、[ART-03 交付](../art/round-03-delivery.md)。

## 逐项验证

- **通过｜测试/构建**：最终配套版本 `npm test` 12/12；最终 `npm run build` 类型检查与生产构建退出 0。[测试日志](round-03-evidence/npm-test.log)、[构建日志](round-03-evidence/npm-build.log)。仍有既有 UI/引擎大包警告，本轮没有进行包体优化。
- **通过｜去掉两栏及碰撞**：配置与运行时静态碰撞从 15 减为 13，只移除两条 Corner rail；起点两栏与横桥两栏保留，橙色统一。新静态模型同步删除对应栏杆/固定件，原并集位置恢复完整直起点栏。
- **通过｜真实锤击出界**：`route-physics.json` 中约 t=4.9462 记录 `collisionstart.other='Pendulum'`，随后球到 `[-6.712,2.397,-6.510]`，已越过原北侧护栏 z=-5.55 并低于台面；之后掉落变 1，回到起点。没有碰到旧位置隐形墙。[落向水池](round-03-evidence/09-hammer-knockout-water.jpg)、[重生](round-03-evidence/10-hammer-respawn.jpg)。水面遮挡水下球属于正常深度关系，实际坐标见物理采样。
- **通过｜玩具锤形状与代理**：短圆端面沿局部 ±Z，柄沿 +Y 向原锚点，原中心轨迹未改。实际碰撞为 capsule/axis=2/radius=.45/height=1.36，总长含端帽；没有保留旧大盒或球代理。几何测试验证基础胶囊包络 [.9,.9,1.36] 及法线旋转。[负相位](round-03-evidence/04-hammer-negative.jpg)、[正相位](round-03-evidence/06-hammer-positive.jpg)、[侧面与柄连接](round-03-evidence/36-toy-hammer-side-profile.jpg)。正面看见圆短端是用户指定朝向，不等于球形网格；侧面能看到长头。
- **通过｜完整运动连接**：平台两周期同时覆盖锤子多个摆动周期，头、柄未分离，未出现重复杆。实际极限姿态与 ART 的 7200 姿态间距检查相符，没有观察到支架/台面穿插；ART 保守包络最低 Y≈3.6126，高于台面 3.4。
- **通过｜两周期完整露空**：1678 个帧样本覆盖 t=0.006～10.1757 秒，超过两个 5.02655 秒周期。实际 X 极值 4.60000086 / 11.39999390，Z 固定 -.35，方程误差小于 4.8e-7 米。四个露空窗口约 .7879/.7814/.7818/.7875 秒，与理论每端 .78393 秒一致。[分析](round-03-evidence/platform-cycle-analysis.json)、[逐帧样本](round-03-evidence/two-cycle-samples.json)、[右端露空](round-03-evidence/03-platform-right-clear.jpg)、[左端露空](round-03-evidence/05-platform-left-clear.jpg)。
- **通过｜平台与导轨/支撑**：模型、盒体和条纹同步 X，导轨表达横移。观察全周期未出现穿过岸体或支撑；独立静态 SAT 检查由 LEVEL/ART 提供，不能单凭该计算替代以下通行实测。
- **通过｜露空掉落与 CP2 重生**：t≈21.5892 平台中心 X≈11.2648，完整离开通道；球在缺口内约 `[8.052,3.598,.560]` 开始下落。t≈22.4262 已回到 `[8.003,3.825,5.006]`，检查点仍为 2，掉落从 1 变 2，计时继续。[CP2 重生图](round-03-evidence/17-gap-fall-respawn.jpg)。
- **通过｜登台、跨缝和离台**：等待平台返回后，t≈30.0308 球在 `[8.194,3.834,.546]`，处于移动平台上；t≈30.4912 已到 `[8.533,3.838,-2.529]`，跨过远侧接缝；t≈31.3166 在远岸 `[8.508,3.825,-3.978]` 稳定承托。此段没有新增掉落。[实际过台](round-03-evidence/19-platform-transit.jpg)、[远岸](round-03-evidence/20-platform-far-bank.jpg)。没有改球体摩擦、岸体、平台尺寸或角速度来补偿。
- **通过｜水池对比与规则**：池水、池沿和池底仅有六个无碰撞配置对象；水面顶 Y=-.1，fallY 仍 -.5，无浮力/承托。深蓝绿色水面与象牙台面、浅蓝平台和圆环明显分开，轻量水纹没有伪装成通路；HUD 浅底保持可读。[起点](round-03-evidence/02-pool-start-high.jpg)、[窄桥](round-03-evidence/12-water-narrow-bridge.jpg)、[平台居中](round-03-evidence/07-platform-centered.jpg)、[终点前](round-03-evidence/20-platform-far-bank.jpg)。
- **通过｜低画质/减少动态**：低画质关阴影后仍能区分缺口；应用减少动态开启时，两个时间不同的运行采样均为 waterOffset=[0,0]，机关继续正常运动。低画质也保持固定水纹相位。[低画质起点](round-03-evidence/23-low-quality-start.jpg)、[低画质缺口](round-03-evidence/24-low-quality-platform.jpg)、[减少动态](round-03-evidence/25-reduced-motion-start.jpg)。测试后恢复 high/false，volume=45、sensitivity=1 全程未调整。
- **通过｜第二轮合并视觉项**：两个圆环未触发/已触发均完整落在台面上，唯一八段警示线无碰撞；四条剩余护栏及其端部正常，没有恢复蓝栏或烘焙重复线。[CP1 未触发](round-03-evidence/32-final-checkpoint-one-untriggered.jpg)/[已触发](round-03-evidence/15-checkpoint-one-triggered-clear.jpg)，[CP2 未触发](round-03-evidence/33-final-checkpoint-two-untriggered.jpg)/[已触发](round-03-evidence/16-checkpoint-two-triggered-clear.jpg)，[起点栏端部](round-03-evidence/34-final-start-rail-ends.jpg)、[横桥栏端部](round-03-evidence/35-final-bridge-rail-ends.jpg)。第二轮原 before/after 和阶段记录保持，不事后伪称当时已通关。
- **通过｜真实资源失败回退**：浏览器临时阻断静态轨道 GLB 与玩具锤柄 GLB，确认没有精细轨道/锤头/柄实例显示，基础胶囊和柱形柄成组回退、四栏/八段线/两环存在，ready 仍为 true，弹珠可移动。未修改配置来假装加载失败。[回退锤与开放路段](round-03-evidence/28-fallback-hammer-and-open-rails.jpg)、[回退护栏/标线](round-03-evidence/31-fallback-remaining-rails.jpg)。随后取消阻断、恢复缓存并刷新，最终模型重新成功显示。
- **通过｜新旧成绩与刷新**：当前新版列表只有 32.83 秒，旧版 57.24 秒保留在可展开的旧纪录区，不计当前最佳；刷新和画质切换保存后各仍一条，没有重复迁移。原 v1 字符串与测试前逐字一致。[刷新后新旧纪录](round-03-evidence/22-versioned-records-reloaded.jpg)、[v2 内容](round-03-evidence/saved-v2.json)、[原 v1](round-03-evidence/original-v1.json)。
- **通过｜暂停、继续与重开**：重开清零并按 t=0 同步机关；暂停采样 a/b 墙钟相隔约 9 分钟，游戏计时均为 .8001，球、锤头、平台和水纹偏移完全相同。多次继续后可正常推进。全路线结算为 32.8325 秒，UI 显示 00:32.83。[结算图](round-03-evidence/21-new-rules-result.jpg)。

## 保护项与可复查命令

[关卡保护审计](round-03-evidence/protected-config-audit.json)按正式授权排除两栏删除、平台轴向/行程及显示导轨、胶囊锤数据、资源引用、规则版本和纯显示水池，其余完整字段深比较一致；包括两处真实检查点/重生、修复后的 ring、八段标线、起终点、机关原轨迹参数等。

[运行时保护审计](round-03-evidence/protected-runtime-audit.json)确认输入控制段、摩擦/阻尼默认值、重力/步长、相机段、键盘与重生、时间格式和奖牌阈值保持。已保存任务前代码片段源文件用于复查，不依赖临时目录或不存在的 Git 历史。

```bash
npm test
npm run build
node docs/levels/round-03-evidence/audit.mjs
node docs/integration/round-03-evidence/audit-protected-runtime.mjs
python3 art/verify_toy_hammer_round_03.py
```

运行资源与实际代理见 [runtime-inspection.json](round-03-evidence/runtime-inspection.json)；动作/状态采样见 [runtime-trace.json](round-03-evidence/runtime-trace.json)，真实接触与路线逐帧数据见 [route-physics.json](round-03-evidence/route-physics.json)。模型失败产生的预期日志单独保存在 [expected-fallback-warnings.json](round-03-evidence/expected-fallback-warnings.json)。

## 测试环境、收尾和边界

复用本项目 Vite 127.0.0.1:5173，另以 5179 临时转发提供独立存储。Node 18.19.0/npm 10.2.3，Codex In-app Browser Chromium，截图 1280×720。按键通过现有监听器派发成对键盘事件，物理正常推进；采样只读，固定相机只用于标明的近景/机制观察，路线使用原跟随镜头。未为可玩性调整相机或直接写游戏状态。图片未经裁切重绘。

一次白屏查明为临时测试代理已退出，原 5173 服务仍正常，重启测试转发后恢复；不是最终版本启动错误。先前并行热更新的异步 host 问题已加最小卸载检查。最终资源阻断、缓存覆盖、诊断相机/采样器和按键均在结束前释放，测试设置恢复；用户原浏览器数据不清除。

本轮没有通关技术阻塞。没有做 Safari、触屏、低配置设备或长时间压力测试；也没有以本次工具成绩校准真人难度。CODE-02 记录的旧 CP1 内凹角静止重生观察仍保留，未据此擅改受保护的真实重生点。

README、COLLABORATION 和协议已更新当前事实及模型入口。CODE-03 完成技术交付，交产品与统筹汇总，并由用户判断最终视觉与体验。

## 平端版恢复实测与优先级调整（2026-09-11）

以上32.83秒与胶囊代理结论属于历史版本，不替代当前平端版。当前新增证据 `flat-route-resume.json` / `flat-route-finished.png`：按原键盘监听驱动，平端版真实完赛41.2841秒、9次掉落，记录平端头接触、两CP、CP2重生及平台登离台。多次掉落来自测试按键在近岸停止后错过平台窗口，改为岸上助跑后通过；不据此校准真人难度或奖牌。390×844新增 `ui-*-390.png` 显示首页自然滚动、游戏无额外滚动，帮助/设置/暂停/结算/纪录入口可用。`steel-rolling-resume.png` 是32张真实游戏帧的前行、停止、倒退及转向序列，数据见 `steel-motion-resume.json`，没有改写球体位置、速度或物理参数；433帧既有诊断继续有效。

用户要求第二关优先，第一关独立实测到此停止。待办：钢珠滚动感最终主观验收及低画质连续对照、平端锤实际击出观察；三旧规则浏览器存档兼容随双关存档改动的必要回归完成。未再调整第一关外观或物理，测试按键/采样回调与临时视口已释放，用户5177服务和原浏览器存档保留。
