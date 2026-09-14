# 可视化关卡编辑器评估

日期：2026-09-14。范围为官方文档与当前项目源码/资源结构的只读评估，未创建在线项目、上传资源、安装工具或改游戏实现，未进行Editor接入实验。结论：**优先验证官方PlayCanvas Editor作为制作工具，加项目专用参数/导出适配；暂不开发完整自建编辑器。**

## 官方现成功能

官方Editor提供3D视口、移动/旋转/缩放工具、层级、属性面板、资源导入、模板实例与实例属性覆盖、多人协作、版本管理、Launch运行及热更新。Script Attributes可在Inspector展示自定义机关参数，参数对应的游戏行为仍由我们的代码实现。

官方导入流程支持GLB和Import Hierarchy，已有独立子节点可成为可操作实体。Templates可拖入多个实例并传播模板修改；这适合我们的重复机关库，但不会从一个已合并网格自动推导可编辑直路/弯路/支撑构件。

官方支持下载应用ZIP后自托管，因此制作采用Editor不等于必须迁走现有Docker/Nginx部署。ZIP是官方场景/资源/脚本应用格式，并非本项目LevelConfig，也不是把ZIP复制进Vue工程就能直接复用当前状态和操控。

官方另有Editor API与Editor MCP Server：可扩展工具面板、自动创建实体/模板/参数并读取视口与Launch运行。Editor API文档仍标Beta，示例部分界面挂载依赖私有调用，应限制自定义扩展范围并固定接口约定。MCP要求已打开并连接正确Editor项目，官方文档要求Node≥22.18；当前评估未安装或配置连接。

## 当前项目的实际差距

1. **静态赛道不是积木。** 对当前GLB只读解析：track-round-03.glb、water-rush-track.glb、mechanism-trial-track.glb均只有1个节点、1个mesh、根TrackStatic。即使导入官方Editor，也只能先得到整关静态模型，不能独立拖动里面某一段S弯。自由搭路需要直段/弯段/坡段/支撑等模块，或在编辑阶段参数化生成新路面，并同步碰撞。
2. **五机关已有复用基础。** obstacle-library.glb有5个稳定根、34节点、18mesh；manifest记录主体尺寸/轴心/动静分件，可封装为模板。渲染层级导入仍需核对是否保留part路径/材质名、米制与原点，不能默认官方转换与当前加载器一致。
3. **关卡数据不直接兼容。** src/game/level-types.ts定义自有LevelConfig，runtime按其创建碰撞与机关，track-visuals只实例化Render并隐藏对应基础外观。官方场景JSON、Entity/asset ID与我们的id/kind/position/yaw/visual/代理字段必须明确映射，不能仅修改模型实体后继续加载旧碰撞数据。
4. **新玩法仍需要程序能力。** platform、turntable、pendulum目前是可选单字段；第四关多出口/分支CP和新蹦床、喷气等只有设计。可视化摆出来不会自动形成分支进度、弹射/局部受力或新多实例运行协议。
5. **试玩需共用真实运行时。** 当前Vue负责状态/设置/商城/成绩，runtime负责输入、物理、机关、水/球材质和生命周期。直接把所有代码搬成另一套Editor脚本会形成双份实现。首选先导出设计数据在当前本地游戏试玩；后续如需官方Launch直接试玩，应抽取可复用核心及独立入口，使用同一逻辑，关闭制作辅助碰撞避免双重实体。
6. **版本一致性需试验。** 本地固定PlayCanvas2.22.1及项目Ammo，官方兼容文档提供v1/v2最新流。不能只因同名引擎就承诺完全相同画面/动力；接入需核对实际引擎版本、Ammo、固定步长、gamma/tonemap、sRGB贴图与主题材质。

## 两条路线的实际工作量

官方Editor适配需要：可复用轨道和机关模块；模板/可见参数/入口出口标记；场景到项目设计数据的导出转换与校验；真实运行时试玩桥接。复杂度中等，首期可限制为少量模块，后续增加机关。

项目内编辑器同样需要上述模块和运行数据整理，还必须开发选择/拾取、三轴拖拽、相机导航、多选/复制、撤销重做、参数面板、导入导出/草稿恢复、吸附与编辑试玩隔离。完整编辑器复杂度明显更高；极简参数面板可以很小，但不等于用户要的自由搭关卡。

因此，对于当前主要由开发者/关卡作者制作关卡的目标，官方工具适配更合适。若未来明确要求普通玩家直接在本站/#/editor搭关、离线使用、全中文极简工具且无需PlayCanvas账号，届时自建精简编辑器才有更直接的产品价值；不要把专业制作工具和面向玩家的创作功能混成同一个需求。

## 推荐制作流程

官方Editor中的模板实例/属性/连接标记 → 单向导出带版本的项目设计JSON → 本地校验并转换为运行配置 → 使用当前Vue+PlayCanvas试玩 → 经Git审核后由现有CI/CD发布。

关卡布局以Editor制作源为准，导出文件作为提交仓库的产物；运行时与玩法代码以Git为准。避免两边同时人工改布局，首期不做双向同步。导出保留稳定实例id、资源逻辑名、原点/单位、参数、CP及schemaVersion，明确不支持字段时报错，不静默丢失。浏览器导出下载/经授权本地工具写入，不假定Editor自动能直接覆盖本地src/levels文件。

旧关卡可继续由原TS/GLB加载，不需要一次搬迁。新编辑关卡逐步采用模块数据，避免换编辑器时回滚现有三关、皮肤和存档。

## 最小接入试验（建议，尚未实施）

先准备一个直路、一个弯路、一个共享库机关（伸缩推墙）及起点/CP/终点。完成一次“拖摆→改方向/周期→导出→当前游戏打开→再编辑”的闭环。关键判据：

- 同一份导出数据决定外观与碰撞，改位置不能只挪模型。
- 改推墙周期/复制实例后，游戏使用新值，不产生重叠旧体或未清理资源。
- 默认球手感和皮肤/设置/历史成绩不因编辑场景导入而改变。
- 出错数据给出明确反馈，未改内容能够稳定再次导出；确认真实资源格式和引擎兼容性。

该试验通过后再扩至13类与连续轨道/分支；自动端口吸附、运动扫掠可视化属于后续专用扩展，自动检查不能替代“可通关”的实际物理测试。不给未经接入试验的完成率或精确工期承诺。

## 账号与费用

官方Editor采用浏览器云端项目。当前官网Plans显示Free为$0/月、无限公开项目、1GB存储；Personal为$15/月、私有项目、10GB；Organization为$50/席位/月、50GB和团队管理。页面同时列出自托管应用下载与REST API。价格/权益以实际开通时官网为准；本次没有创建公开项目、上传本地资产、开通订阅或改变访问权限。

## 官方来源（本次实际读取）

- [Editor能力概览](https://developer.playcanvas.com/user-manual/editor/)
- [Templates与实例覆盖](https://developer.playcanvas.com/user-manual/editor/templates/)
- [资源导入与Import Hierarchy](https://developer.playcanvas.com/user-manual/editor/assets/import-pipeline/)
- [脚本属性与Editor脚本流程](https://developer.playcanvas.com/user-manual/editor/scripting/)
- [应用导出和自托管](https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/)
- [Editor API及Beta边界](https://developer.playcanvas.com/user-manual/editor/editor-api/)
- [官方Editor MCP Server](https://developer.playcanvas.com/user-manual/editor/mcp-server/)
- [引擎兼容性](https://developer.playcanvas.com/user-manual/editor/engine-compatibility/)
- [当前Plans](https://playcanvas.com/plans)

结论依据为公开文档和当前源码/GLB结构读取；未做在线导入、运行验证或授权新的编辑器开发任务。

后续研究已整理为 [PlayCanvas可视化关卡制作接入方案](playcanvas-editor-plan.md)，包含模板、导出协议、试玩隔离、分支编辑和分阶段验收；仍为方案文档，Editor接入尚未实施。
