# ◈ Touchstone · 多模型试金石

把同一个任务并行下发给本地的多个 AI CLI（Claude Code / Codex / Gemini CLI），每个模型在独立文件夹里产出作品，网页上以对比网格实时展示运行效果——类似社交平台上常见的「多模型同题对比」视频，但全自动。

## 快速开始

```bash
npm run setup   # 一次性：安装依赖 + 构建前端
npm start       # 启动服务
```

打开 http://localhost:3000 ，填写项目名和任务描述，（可选）为每个 CLI 指定模型，点「⚡ 下发任务」。

> Gemini CLI 首次使用前需在终端运行一次 `gemini` 完成浏览器登录授权，否则 headless 模式会直接退出。

## 工作原理

1. 后端按 **项目优先** 的结构为每个勾选的模型创建工作目录：

   ```
   runs/
   └── bouncing-ball/          # 项目
       ├── claude/             # 各模型作品（指定模型时为 claude-opus 这类命名）
       ├── codex/
       └── gemini/             # 同项目重复运行同模型时自动加 _2、_3 后缀
   ```

2. 以该目录为工作目录、全自动模式启动 CLI 子进程（每次都是全新独立会话）：
   - Claude Code：`claude -p "<任务>" --dangerously-skip-permissions [--model xxx]`
   - Codex：`codex exec --full-auto --skip-git-repo-check "<任务>" [-m xxx]`
   - Gemini：`gemini -p "<任务>" --yolo [-m xxx]`
3. 任务自动附加「交付要求」：必须产出可直接在浏览器打开的 `index.html`
4. CLI 输出实时写入 `.touchstone.log` 并通过 WebSocket 推送到网页
5. 目录里一旦出现 HTML 入口，卡片立即等比缩放预览（1280×800 虚拟视口，内容完整可见），点击可全屏查看
6. 卡片上 CLI 名称右侧显示 **实际执行模型**：显式指定的直接记录；未指定的从运行日志（codex 打印 `model:`）或各 CLI 本地配置探测
7. 任务完成后自动 `git commit`（按项目归档作品代码）并 `git push`

## 配置（agents.json）

- 增删模型、修改 CLI 命令和参数（`{{PROMPT}}` 占位符会被替换为任务内容）
- `modelFlag` / `models`：模型参数名与候选模型（表单中也可自由填写任意模型名）
- `defaults.timeoutMinutes`：单任务超时（默认 20 分钟）
- `defaults.git`：`autoCommit` / `autoPush` 开关
- `defaults.artifactHint`：自动附加的交付要求文案

## 前端开发模式

```bash
npm start        # 终端 1：后端 (3000)
npm run dev:web  # 终端 2：Vite 热更新 (5173，已配置代理)
```

技术栈：Express + ws / React 18 + Vite + Tailwind CSS v4 + lucide-react，liquid glass 视觉。

## 注意

- 三个 CLI 均以「跳过确认」的全自动模式运行，只在工作目录内操作，但理论上权限不受限，请只下发可信任务
- 删除卡片会同时删除对应的作品文件夹
- `.touchstone.log` 不入库（.gitignore），仓库里只保留作品代码
