# 2026-09-14 发布测试失败

用户报告发布失败，提供 [Actions任务](https://github.com/zjj873994125/marble-lab/actions/runs/34817330967/job/103890710241)。对应提交 `921ea1dc39bd5148f540aaa8d20f41ad47a415bf`；npm ci成功，npm test共40项、39通过、1失败，build/publish/deploy未执行。

统筹通过已登录浏览器读取测试步骤日志100–117行：`not ok 16 - 推墙五阶段与翻板预告不增加安全时长，打开后板心绕侧轴下移`，ERR_ASSERTION，expected true、actual false，堆栈 `tests/library-motion.test.mjs:56:10`，对应 `libraryPose(trapdoor, 3.6).warning`。

代码中 `cycleTime` 对所有余数加cycle再取余，正的3.6在8.5秒周期中被额外加减引入舍入，落到预告边界下方；CODE负责最小修改负数归一逻辑、保留原断言并补边界回归。不改变阶段参数，不删测试或跳过CI。当前本地未提交赛道主题与本次失败的已提交版本区分，不把主题改动冒充修复。

按用户现有偏好不自动运行本地测试/构建或重跑远程流水线，不Git写入/部署。修复未复测不能称CI已通过；用户之后需提交修复以触发新流水线，重跑原失败提交仍使用旧代码。

状态：**CODE已完成最小修复，尚未复测或推送**。`library-data.ts`非负余数直接返回，只对负余数补周期；原3.6秒断言保留，`library-motion.test.mjs`追加边界两侧、整周期和负相位回绕用例，均未运行。任务开始时这两文件与HEAD一致，修复为本轮新增，不涉及主题修改。完整交付见 [CI修复说明](../integration/ci-921ea1d.md)。
