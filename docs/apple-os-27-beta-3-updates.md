# iOS 27 与 macOS 27 Beta 3 更新内容整理

> 核对时间：2026-07-07（Asia/Shanghai）
> 说明：公开来源中未发现 Apple 发布过 `iOS 27.3 beta` 或 `macOS 27.3 beta`。Apple Developer 当前列出的最新 27 系列开发者测试版是 `iOS 27.0 beta 3` 与 `macOS 27.0 beta 3`，发布时间为 2026-07-06。本文按“27 beta 3”整理。

## 版本信息

| 平台 | 当前 beta | Build | 发布时间 | 备注 |
| --- | --- | --- | --- | --- |
| iOS | iOS 27.0 beta 3 | 24A5380h | 2026-07-06 | 与 iPadOS 27.0 beta 3 同 build |
| macOS | macOS 27.0 Golden Gate beta 3 | 26A5378j | 2026-07-06 | Apple 官方命名为 macOS 27 Golden Gate |

## 面向用户的主要变化

### iOS 27

- Siri AI：更强的对话式 Siri，支持自然语言追问、个人上下文检索、跨应用执行操作，并提供独立 Siri app。Apple 标注 Siri AI 会在今年稍晚以英文 beta 形式推出。
- 相机与视觉智能：相机中加入 Siri mode，可从取景器直接发起视觉搜索、提问和行动。
- AI 图片编辑：照片编辑包含 Spatial Reframing、Extend、增强版 Clean Up 等能力。
- Apple Intelligence 深入系统应用：Messages、Mail、Safari、Shortcuts、Home 等加入智能建议、内容处理、自动化与搜索能力。
- Safari：自动将标签页组织为 topics；Safari Notify Me 可监控网页变化并提醒。
- Passwords：可提示弱密码或泄露密码，并支持一键协助更新。
- Child Safety：Setup Assistant、Ask to Browse、Communication Safety、Time Allowances 与 Screen Time Schedules 均有扩展。
- OS 改进：Liquid Glass 可读性与对比度优化，新增外观调节滑杆；Apple 宣称 app 启动、照片加载、AirDrop 传输等性能提升。
- 其他：iCloud Shared Albums 改进、Health 中围绝经期/绝经支持、Maps Flyover 增强、AirPods Custom EQ、HomeKit Secure Video 4K 与智能搜索、GymKit on iPhone。

### macOS 27 Golden Gate

- Siri AI on Mac：支持自然语言问答、个人上下文检索、跨 app 操作；Spotlight 顶部可选择 Ask Siri；提供独立 Siri app。
- Visual Intelligence：可分析屏幕内容并辅助搜索、提问和操作。
- Apple Intelligence：Photos、Messages、Safari、Shortcuts、Mail、Home 等系统 app 有更深集成。
- 设计改进：Liquid Glass 可读性、折射和对比度优化；统一 toolbar、edge-to-edge sidebar、窗口形状和菜单栏图标更新；提供 Liquid Glass 外观滑杆。
- 性能改进：Apple 提到 AirDrop、网络文件浏览、Safari Start Page 内容加载等更快。
- Mail Search：新排序系统把相关邮件结果前置。
- Mac 独有/重点能力：Calendar 支持用自然语言描述新增/编辑事件；更好的 ultrawide display 支持；Mac app 中加入 swipe down to refresh；视频播客体验更新。
- 兼容性：macOS 27 官方兼容 Apple silicon Mac，包含 MacBook Neo、2020 年及之后 Apple silicon MacBook Air/Pro、2021 年及之后 iMac、2020 年及之后 Mac mini、2022 年及之后 Mac Studio、2023 年 Apple silicon Mac Pro。

## 开发者关注点

### iOS / iPadOS 27 Beta 3

- SDK：iOS & iPadOS 27 SDK 支持 beta 3，随 Xcode 27 提供。
- App Intents：`notes.createNote` 与 `notes.updateNote` schema 支持 `AttributedString` 类型的 name 参数；`calendar.deleteEvents` 重命名为 `calendar.deleteEvent`。
- Core AI：Apple Intelligence 设备上的 Neural Engine 有改进；后台 Neural Engine 访问受限，需新 entitlement `com.apple.developer.background-tasks.continued-processing.inference`；大模型加载性能与 Instruments 中内存归因改善。
- Foundation Models：修复多个 `@Generable`、`onPrompt`、`LanguageModel` 相关问题；Private Cloud Compute 在模拟器上仍可能不可用。
- HealthKit：新增心率区间、骑行功率区间；权限流支持用户授予 limited history 或 full history；新增 menopausal state 与 bleeding after menopause sample type。
- HomeKit：启用 Home app 中 Apple Intelligence 后，HomeKit Secure Video 会通过端侧处理和 Private Cloud Compute 支持视频描述与搜索。
- MetricKit：新增 Swift-first `MetricManager`、`CrashDiagnostic.terminationCategory`、内存越限诊断、Metal frame pacing 指标等；旧 `MXMetricManager` 等 API 不再推荐新项目采用。
- Network Security：27.0 系统中，MDM、DDM、自动设备注册、配置描述文件、app 安装、软件更新等系统进程开始执行更严格 TLS 要求，服务器至少需 TLS 1.2 并满足 ATS 级别的证书与 cipher suite 要求。
- SwiftUI：`AsyncImage` 支持 HTTP 缓存；`Text` 选择与 `TextRenderer` 改进；`@State` 引入新的宏实现；新增异步文档协议 `ReadableDocument` / `WritableDocument`；`FileDocument` deprecated。
- UIKit：27.0 SDK 构建的 iOS/iPadOS app 必须包含 launch screen；新增 scene state restoration API；iPadOS 菜单/上下文菜单默认减少图标显示；采用最新 SDK 的 app 必须使用 scene-based lifecycle。
- VideoToolbox：`VTLowLatencySuperResolutionScalerConfiguration` 支持 1.5x scale factor；`VTLowLatencyFrameInterpolationConfiguration` 支持最高 1080p 的任意 source dimensions。
- TrustInsights：应用可通过 Xcode capability 使用 TrustInsights framework，需 entitlement 与网络连接。

### macOS 27 Golden Gate Beta 3

- SDK：macOS 27 SDK 支持 macOS 27 Golden Gate beta 3，随 Xcode 27 提供。
- AppKit：Open/Save panel 的 Recents 可用 `Cmd-Shift-F`；新增 `NSRefreshController` 为 `NSScrollView` 提供 pull-to-refresh；toolbar/segmented control 引入 role 概念；菜单图标显示策略变化，可用 `NSMenuItem.preferredImageVisibility` 调整。
- Automatic Assessment Configuration：macOS 27 提供更细粒度考试/测试环境控制，包含 Dock、Menu Bar、辅助功能设置、系统预检查和 app 启动限制。
- DiskImageKit：新增 Swift API，用于创建和管理 ASIF 与 raw disk image，可配合 Virtualization framework。
- Rosetta / Intel 过渡：macOS 27 中此前设置为 “Open using Rosetta” 的 app 会改为原生启动；升级后 Rosetta 不会自动恢复；Apple 标注 Intel-based software 将在 macOS 28.0 不再兼容（legacy games 例外）。
- Gaming：beta 中提供 `sudo game-test-tool enable` 支持 legacy Intel-based games；该模式会禁用 Rosetta，非游戏进程可能异常，仅用于 beta 测试。
- HomeKit：Apple Intelligence for Home 除设备/家庭中枢要求外，release notes 标注需要 2TB 起步的 iCloud+ 订阅。
- System Integrity Protection：跨开发团队访问其他 app data containers 和 app group containers 默认拒绝；XProtect 可限制对常被恶意软件攻击的 app data 的访问。
- Virtualization：vmnet port forwarding API 支持 loopback；保存/恢复带 USB passthrough 的 VM 状态仍有已知问题。
- Preview / Quick Look：USD 等 3D scene 的渲染支持 RealityKit 作为 renderer。
- SwiftUI：与 iOS 同步包含 `AsyncImage` 缓存、`@State` 宏实现、异步文档协议、菜单图标策略调整；macOS 还改进 bordered `Menu`/`Picker` label customization。

## Beta 3 已知问题摘录

### iOS / iPadOS

- Camera：Portrait mode 的虚化效果可能渲染不正确。
- CarPlay：地图面板、方向盘上一首/下一首按钮、Spatial Audio 与 stereo 内容混播后静音、Siri 响应慢等仍有问题。
- Clock：锁屏响铃闹钟可能无法直接停止，需要解锁或用语音停止。
- Photos：Spatial Reframing 后色相可能轻微变化；已 Extend 的照片再次进入 Extend 工具可能导致 Photos 退出。
- Safari：标签栏可能进入不显示状态，需重启 Safari；Safari Intelligence 功能在资源下载完成前可能提前显示可用。
- Siri：选择照片后，Siri 可能无法正确识别当前选中的照片；部分 Maps、Reminders、photo 操作需要更精确表达或 workaround。
- Writing Tools：在使用 Writing Tools 时点击 Plus 可能导致无响应，workaround 是强制退出 Messages。
- Weather Highlights：目前仅支持 US English。

### macOS

- Finder：基于内容的文件/文件夹建议名称可能过于泛化。
- Mail：Smart Mailboxes 使用期间可能不更新，锁定且空闲时才更新。
- Safari：sidebar context menu 中 Rename / Edit Address 可能无效；Safari Intelligence 资源未下载完时可能提前显示。
- Siri：在 Photos 中找不到 albums；通过 AMap、Tencent Maps、Baidu Maps 发起导航可能失败；Ask Siri 可能在 Siri 关闭或区域不支持时仍出现在菜单中。
- Software Update：启动磁盘为外置存储时无法安装 Background Security Improvements；Reduced Security 模式设备可能无法安装 beta 1。
- Thunderbolt：连接两台相同型号和序列号的显示器时，第二台可能不亮。
- Window Management：通过 Mission Control 退出 fullscreen 后窗口可能丢失。
- Writing Tools：使用 Describe Your Change 后可能停止工作，需重启 Mac 或在 Activity Monitor 中强退 Writing Tools。
- XQuartz：点击后台 X11 窗口不会激活 XQuartz，需要点 Dock 图标。

## 兼容性与可用性注意

- Siri AI：Apple 标注会在今年稍晚以 beta 形式推出，初期为英文；iOS/iPadOS/watchOS 上初期不在欧盟提供。
- Apple Intelligence：需要 Apple Intelligence 支持设备，且 Siri 与设备语言设置为支持语言。Apple 官方列出的支持范围包括 iPhone 16 系列及之后、iPhone 15 Pro/Pro Max、M1 及之后 iPad/Mac、Apple Vision Pro M2 及之后等。
- 高级 AI 功能：部分 Apple Intelligence 功能需要更新设备，例如 iPhone 17 Pro/Pro Max、iPhone Air、M4 且 12GB 统一内存以上的 iPad、M3 且 12GB 统一内存以上的 Mac、Apple Vision Pro M5。
- macOS 27：兼容列表只包含 Apple silicon Mac，Intel Mac 不在官方兼容列表内。
- Beta 风险：上述内容仍处于开发者 beta 阶段，功能、可用地区、语言、API 行为和兼容性都可能随后续 beta 调整。

## 来源

- Apple Developer Releases: https://developer.apple.com/news/releases/
- Apple iOS 27 Preview: https://www.apple.com/os/ios/
- Apple macOS 27 Golden Gate Preview: https://www.apple.com/os/macos/
- iOS & iPadOS 27 Beta 3 Release Notes: https://developer.apple.com/documentation/ios-ipados-release-notes/ios-ipados-27-release-notes
- macOS 27 Golden Gate Beta 3 Release Notes: https://developer.apple.com/documentation/macos-release-notes/macos-27-release-notes
- Apple Developer Documentation JSON endpoint for iOS release notes: https://developer.apple.com/tutorials/data/documentation/ios-ipados-release-notes/ios-ipados-27-release-notes.json
- Apple Developer Documentation JSON endpoint for macOS release notes: https://developer.apple.com/tutorials/data/documentation/macos-release-notes/macos-27-release-notes.json
