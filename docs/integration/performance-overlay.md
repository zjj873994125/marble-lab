# 实时性能信息 · 代码交付

2026-09-14。已实现默认关闭的性能开关、主Application采样与同行读数，按最新位置要求没有另占一排的大卡。未运行test/build/typecheck、浏览器或Git操作；以下为源码口径，数值准确性与响应式布局尚未实测。

## 位置与设置

settings.showPerformance仅接受布尔true作为开启，默认/缺失/非法为false，恢复默认关闭。v3只保存开关，性能样本存在App局部ref，不进入设置、成绩或持久化watch。纯净模式不会自动打开此开关。

首页读数位于top-actions中，就绪胶囊左侧，与帮助/设置同行；完整HUD位于右上暂停按钮旁；纯净模式右上与左上计时器同顶行。显示为单行“FPS · ms”，有空间时在同行附绘制调用/三角面。窗口或实际可视宽≤1200时收起辅助指标；详情通过同排现有按钮/容器的title查看，读数本体pointer-events:none，不抢输入。

启用性能信息的窄首页压缩导航/状态间距，≤1050px收起装饰品牌轨道图标、保留中文品牌，≤480px进一步收紧字号和帮助/设置图标尺寸，避免增加新行。纯净读数与完整HUD顶行使用visualViewport偏移和安全区。首个样本前、缺失统计及停绘时为“—”，不硬编码0或示例帧率。

只采集首页/挑战的主Application；图鉴独立预览不采集，纪录等非主界面停止采样。切关/组件卸载清空读数，不沿用上一关。暂停时只要画布仍渲染就继续采集。

## 精确口径与引擎时机

本地PlayCanvas 2.22.1的ApplicationStats.updateBasic在每次tick开头将上一次绘制的device._drawCallsPerFrame搬入app.stats.drawCalls.total并清零，然后触发frameupdate。development构建同位置还调用updateDetailed，读取并清零图元统计。

`src/game/performance.ts`用postrender记录实际主场景绘制回调的performance.now墙钟时间，再在下一次frameupdate读取与该帧配对的app.stats。这样不会把本次绘制时间配到旧一帧计数，也不依赖timeScale或游戏elapsed。

- 每约750ms汇总一次。FPS=窗口内渲染帧间隔数×1000/墙钟跨度；ms=跨度/帧间隔数，是平均帧间隔，**不是GPU耗时**，也不以CPU渲染函数耗时代替它。
- 绘制调用为同一窗口app.stats.drawCalls.total的均值，展示四舍五入整数。它包括引擎实际提交的主通道、阴影、其它绘制等，不等于实体数量，也不包含Vue DOM绘制。
- 三角面为同一窗口app.stats.frame.triangles的均值，含引擎按图元/实例/重复pass统计的数量，不是GLB文件面数相加。
- **生产包限制**：当前production/default PlayCanvas不执行updateDetailed，亦不累加详细_primsPerFrame，frame.triangles的初始0不可当成真实统计。按Vite当前development导出时才启用该字段；生产版显示“—”。未为此切换引擎到debug/profiler，也未补造数字。

正常窗口每750ms只创建/上报一个样本对象，App的格式化computed也只随样本变化，无每帧存储或DOM数值更新。不开独立rAF、不改变帧率、物理步进或画质。一个仅开启时存在的低频看门狗，在最后实际绘制超过约1秒时清空窗口；关闭/隐藏/卸载清理定时器和监听，恢复从新帧重新计时。

## 文件与验证边界

`src/game/performance.ts`采样；`runtime.ts → GameCanvas.vue → App.vue`回传；SettingsPanel/state保存开关；style.less负责同行布局。初始化失败、取消、app.start异常和正常销毁均关闭采集，重复开关不叠加监听。主场景之外无额外采集器。

`tests/performance.test.mjs`覆盖模拟事件顺序、零timeScale、汇总频率、未知三角面、隐藏/恢复/停绘及关闭清理；state用例覆盖严格布尔/恢复默认与历史保留。均未执行；没有浏览器/设备性能校准结果。首页按钮、纯净1200/600、当前水色、赛道皮肤与CI周期精度修复继续保留。
