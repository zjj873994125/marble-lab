# 游戏纯净模式 · 代码交付

2026-09-14，依据 [产品任务](../product/clean-mode.md)。已完成设置、保存、自动尺寸判断及纯净HUD代码；按用户要求未运行test/build/typecheck、浏览器或Git操作，不宣称视觉/交互验收通过。

## 模式与保存

设置“纯净模式”提供自动/开启/关闭，内部值为auto/on/off，默认auto。实际纯净HUD条件为on，或auto且可用窗口宽≤1200 CSS px或高≤600 CSS px；off始终显示原完整HUD。大窗口在auto下恢复完整HUD，手动选择优先于尺寸。

`src/state.ts`增加Settings.cleanMode与默认值，旧存档缺失/非法字段均回auto；恢复默认沿用Object.assign(settings,defaults)，因此也回auto。v3只保存三档偏好，不保存按尺寸算出的生效状态；原设置、全部关卡/规则历史桶、游玩进展和只读v1/v2原文保持。resize、临时缩放和键盘出现不会覆盖手动偏好或因HUD切换写入存档。

## 可用窗口与HUD

`src/App.vue`复用既有viewport监听。初次读取和挂载时获取尺寸，window.resize/orientationchange及visualViewport.resize更新；可用宽高分别取innerWidth/innerHeight与visualViewport对应正尺寸的较小值，无visualViewport时回退窗口尺寸。新增visualViewport.scroll监听仅跟随可视窗口偏移定位计时器，与其他监听一起卸载释放。

原touchMode和portraitBlocked继续读取布局窗口宽高及pointer:coarse，不用键盘/缩放后缩小的可视区域重新判断触控或竖屏，保持已有摇杆与旋屏暂停逻辑。纯净判断独立，因此736×439的桌面窗口在auto下也会使用纯净HUD。

游戏中纯净模式只渲染左上计时数字，22px等宽数字、紧凑浅色底、至少44px高。计时器采用原生button，aria-label含用时和暂停说明，aria-haspopup=dialog；点击/触控/Enter/Space将state.phase设为paused，进入原暂停流程。按钮的Space/Enter keydown停止冒泡，保留原生按钮默认激活，避免Space被运行时全局刹车处理拦截；Esc/R照常进入现有键盘路径。

隐藏原game-summary、mobile-status及CP信息、progress-rail、control-hint、restart和独立pause按钮。TouchControls仍由原touchMode/playing/portrait条件控制，摇杆刹车不受纯净裁减。暂停和结算时不重复显示纯净计时器，原暂停菜单的继续/重开/设置、结算、设置抽屉、错误/保存失败及必须处理的旋屏提示保留。可经计时器→暂停→游戏设置关闭纯净模式。

计时器固定定位叠加visualViewport偏移，并给左/上安全区至少12/10px留白。首页、图鉴和纪录页不会渲染纯净计时器，也不受HUD条件裁减；本轮没有修改刚完成的首页按钮布局、关卡、模型、玩家力或镜头。

## 文件与未验证边界

- `src/App.vue`：可用窗口读取、计算模式、计时按钮与HUD条件。
- `src/components/SettingsPanel.vue`：三档设置与暂停入口说明。
- `src/state.ts`：偏好类型、默认值及旧存储回退。
- `src/style.less`：独立clean-timer样式，不改已有首页/其他页规则。
- `tests/state.test.mjs`：更新新增默认字段的已有断言，补偏好非法值/保存/刷新/恢复默认及历史桶保留用例；**仅编写，未执行**。

尚未验证：构建/类型、1200/600边界的实际窗口切换、visualViewport缩放/键盘偏移、屏幕阅读器和键盘激活、真机触控、弹窗焦点与实际遮挡效果。自动模式为纯computed读取，不通过watch改写设置；该源码事实不替代浏览器行为验证。
