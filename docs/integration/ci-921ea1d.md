# 921ea1d CI失败定位与修复

2026-09-14。已定位到翻板预告边界的周期取模舍入问题，完成最小源码修复并保留原失败断言。按用户要求没有运行本地test/build/typecheck，没有Git写入、重新触发CI或部署，修复后通过结果尚未取得。

## 失败证据与版本

- [GitHub失败job](https://github.com/zjj873994125/marble-lab/actions/runs/34817330967/job/103890710241)，run 34817330967、job 103890710241、check步骤。
- 公共GitHub API确认head_sha为`921ea1dc39bd5148f540aaa8d20f41ad47a415bf`，提交名“第三关”；npm ci成功，npm test失败，build/publish/deploy均skipped。因此不是构建或部署超时。
- 统筹从已登录页面取得日志step 5 L100：`not ok 16 - 推墙五阶段与翻板预告不增加安全时长，打开后板心绕侧轴下移`。
- 测试位置`tests/library-motion.test.mjs:43:1`，ERR_ASSERTION为`false !== true`，堆栈`tests/library-motion.test.mjs:56:10`，即`assert.equal(libraryPose(trapdoor,3.6).warning,true)`。
- 用户提供的汇总为tests 40 / pass 39 / fail 1，末尾39/40通过不是失败项。完整日志下载公共接口返回403、公开页面提示登录；本次具体失败段以统筹登录页回传为证据，不伪称已匿名下载完整日志。

## 根因与最小修复

默认翻板阶段为[4.5,1,1.5,1.5]，周期8.5秒，预告从4.5−.9=3.6秒开始。旧cycleTime对正数也执行`((time % cycle)+cycle)%cycle`。3.6本已在周期内，但加8.5再取模会引入浮点舍入，归一化结果落成约3.5999999999999996，于是与3.6作`>=`比较为false。CI精确失败断言与此源码路径吻合。

`src/game/library-data.ts`现在先求余数，非负时直接返回，只对负余数补周期并归一化。没有改预告时长、阶段阈值、关卡参数或物理，没有加epsilon放宽运行条件，也没有删测试/跳过CI。原3.6秒应为true的断言保持。

`tests/library-motion.test.mjs`补充边界两侧采样、整周期回绕及负phaseSeconds回绕用例。测试采样的1e-10只是测试输入间距，没有加入运行时阈值或时钟；原精确3.6断言仍负责此缺陷回归。新增用例未运行。

## 已提交与本地差异

任务开始时本地HEAD就是921ea1d；`library-data.ts`和`library-motion.test.mjs`与HEAD无差异，所以该问题不是已有修复仅未推送。上述两文件的修复是本次新增的未提交修改。

七款主题功能仍是任务开始前的未提交工作。HEAD的state不含trackTheme，其既有settings断言已包含cleanMode；本地state.test新增的trackTheme默认字段、主题保存用例和材质测试不是此CI40项失败的版本，不能把它们误认成线上根因或此处修复。本次没有编辑state.test、state或主题文件，也没有覆盖其他任务的关卡设计。

本次改动仅`src/game/library-data.ts`、`tests/library-motion.test.mjs`及本说明。源码修复完成，当前不能宣称本地测试或CI已经转绿。
