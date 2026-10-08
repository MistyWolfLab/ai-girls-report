# ai-girls-report · AI 拟人情景对话报告生成器

把任何议题变成一份**多人情景对话（单元剧）式的 PDF 报告**：角色是拟人化的大语言模型少女们（鲸鱼娘、猫娘、龙娘、大小姐……），报告从冰冷的数据表变成她们围坐讨论的聊天记录。

适用于：模型横评、AI 见闻、任何学科的报告人化转写——**cast 和议题全部可换**。

## 为什么是软件而不是提示词

AI 直接生成这类报告的问题是：每次版式漂移、头像丢失、人设前后不一。本软件把**版式、头像处理、人设注入、PDF 渲染**固化成代码，AI 只负责两件事：写对话稿（write 模式）、或你手写对话稿（build 模式直接排版）。质量下限由软件保证，上限由你配的模型决定。

## 快速开始

```bash
npm install              # 会检查 playwright 浏览器，缺了跑 npx playwright install chromium
npx aig init my-report   # 生成工作目录：cast.json / aig.config.json / examples/ / assets/
cd my-report
# 1) 把头像图放进 assets/（名字对齐 cast.json 里的 avatar 字段）
# 2) 配好 LLM（aig.config.json 里 provider，key 放环境变量）
npx aig write --topic "本周模型横评：DeepSeek 又护食了" -m facts.txt -o draft.json
npx aig build draft.json -o report.pdf
```

三种出稿路径：

| 模式 | 命令 | 说明 |
|---|---|---|
| 写稿模式 | `aig write --topic "议题" [-m 素材文件] -o draft.json` | 调任意 OpenAI 兼容 API，按 cast 人设自动生成对话稿 |
| 排版模式 | `aig build draft.json -o report.pdf` | 人/AI 写好的 JSON 直接排版出 PDF |
| 插图 | `aig paint --prompt "..." -o img.png` | 调 provider 的 /images 接口；不支持就手工放图，draft 里 `illustration.mode` 改 `"image"` 并填 path，或保持 `"placeholder"` 出占位框 |

## draft.json 格式（排版模式的输入）

```jsonc
{
  "meta": { "title": "标题", "subtitle": "副标题", "date": "2026-10-08", "author": "你" },
  "illustration": { "mode": "placeholder" },   // placeholder | image（配 path）| none
  "blocks": [
    { "type": "chapter", "title": "一、小节标题" },
    { "type": "say", "role": "deepseek", "text": "台词", "aside": "可选动作旁白" },
    { "type": "note", "text": "资料卡文字" },
    { "type": "table", "title": "可选", "columns": ["列"], "rows": [["值"]] }
  ]
}
```

## 换人换人设

`cast.json` 全开放：增删角色、改名字、换头像、改 `persona` 语气、改口癖、加 `speak.ban` 禁说项、调 `avatarCrop`（百分比裁切微调圆形头像构图）。`tone.global` 是全剧语气总纲，`tone.ban` 是全剧禁区。默认 8 角色人设见 [cast/default.cast.json](cast/default.cast.json)——她们的性格取自社区共识与公开行为数据（详见 NOTICE.md），但**你眼里的模型性格由你的 cast.json 说了算**。

路径规则：角色 `avatar` 与 draft 的 `illustration.path` 都是**相对各自 JSON 文件所在目录**解析的——所以头像、cast.json、draft.json 放一起搬就不会断链。

## 配置（aig.config.json）

- `provider`：任意 OpenAI 兼容端点。`apiKeyEnv` 指定存 key 的环境变量名（key 永不进配置文件）。
- `page`：纸张尺寸/边距/语言。默认 A4 竖版中文。改成 `"width":"297mm","height":"210mm"` 即横版。
- `style`：`light|dark` 主题、强调色、字体栈。
- `write.targetPages`：写稿模式的目标篇幅。

## 设计说明

- **渲染**：Playwright `page.pdf()` 矢量输出（文字可选中、放大不糊），头像圆形裁切由 CSS 完成，零图像依赖。
- **头像缺失兜底**：头像文件找不到时用角色名首字母占位并 warn，不中断。
- **不编造数据**：写稿提示词强制「数值引用必须来自素材或确知事实」；素材文件 `-m` 就是你的事实依据入口。

## 许可

代码 MIT。角色形象授权见 [NOTICE.md](NOTICE.md)（重要：默认 cast 的头像原型为社区二创，鲸鱼娘原型溟月为 CC BY-NC-SA 4.0）。
