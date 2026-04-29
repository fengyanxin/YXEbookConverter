# 电子书格式转换工具

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

一个**完全运行在浏览器里**的电子书格式转换 Web 应用。文件不上传任何服务器，转换全部在本地完成，零依赖后端，开箱即用。

> 在线演示：https://yxebookconverter.netlify.app
>

## ✨ 特性

- 纯前端实现，**文件不离开你的浏览器**，隐私友好
- 支持 **TXT / Markdown / HTML / EPUB** 之间的常用互转
- **真正的 EPUB 3 打包**（含 `nav.xhtml` / `toc.ncx` / 章节 XHTML / `mimetype` STORE 优先）
- HTML / Markdown → EPUB 时自动**按 h1 / h2 拆分章节**
- 内嵌 **data URI 图片自动提取**，相对路径图片支持**附带图片上传**匹配
- 支持上传**封面图片**（按 EPUB 2 / 3 双重声明，生成 `cover.xhtml`）
- 现有 EPUB 可直接**编辑元数据 + 替换封面**
- 现代极简 UI，响应式，含转换进度与本地历史记录

## 已支持的转换

| 源格式   | 目标格式 | 说明                                                       |
| -------- | -------- | ---------------------------------------------------------- |
| TXT      | EPUB     | 自动识别"第 X 章 / Chapter N"等标题分章                    |
| TXT      | HTML     | 生成单文件 HTML，含简单排版样式                            |
| Markdown | EPUB     | 通过 marked 转 HTML 再分章；按 h1/h2 自动拆分              |
| Markdown | HTML     | 生成单文件 HTML                                            |
| HTML     | EPUB     | 自动清理脚本/外链，按 h1/h2 拆分章节并打包为 EPUB 3        |
| HTML     | TXT      | 提取正文文本                                               |
| EPUB     | TXT      | 按 spine 顺序提取正文                                      |
| EPUB     | HTML     | 把所有章节合并为一个 HTML 文件                             |
| EPUB     | EPUB     | 编辑元数据 + 替换/添加封面后重新打包                       |

转换为 EPUB 时还可选：

- **封面图片**：上传 jpg / png / webp 等，自动写入 EPUB
- **附带图片**：HTML / Markdown 里的相对路径 `<img>` 会按文件名匹配你额外上传的图片并打包；data URI 内嵌图片自动提取，无需手动选择

> PDF / MOBI / AZW / DOC 等格式通常需要后端工具（Calibre、Pandoc 等）才能完成高质量转换，纯前端短期内不会支持。

## 🚀 快速开始

### 方式一：直接用浏览器打开

把项目下载下来，双击 `index.html` 即可。需要联网（用于加载 JSZip / marked CDN）。

### 方式二：本地静态服务器

任选一种：

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx http-server -p 8000

# PHP
php -S localhost:8000
```

然后访问 <http://localhost:8000>

### 方式三：一键部署到静态托管

不需要任何构建步骤，可直接部署到任意静态主机：

| 平台 | 操作 |
| ---- | ---- |
| **GitHub Pages** | 进入仓库 Settings → Pages → Source 选择 `main` 分支根目录 |
| **Vercel** | `vercel deploy` 或在面板导入仓库（无需配置） |
| **Netlify** | 拖拽整个项目目录到 Netlify Drop |
| **Cloudflare Pages** | 创建项目 → 选择仓库 → Build command 留空，Output 留 `/` |
| **EdgeOne Pages** | 控制台导入仓库即可 |

## 🧭 使用流程

1. 把文件**拖拽**到上传区，或**点击**选择文件
2. 选择目标格式（不同源格式可选项不同，例如 TXT 只能转 EPUB / HTML）
3. 转 EPUB 时可选**封面图片**和**附带图片**；编辑现有 EPUB 时可填写**标题 / 作者 / 语言 / 出版社 / 简介 / 标识符**
4. 点击 **开始转换**，等待完成后下载文件
5. 转换历史保存在浏览器本地，最多 10 条

按 `Esc` 可在非转换中状态快速回到上传页。

## 📁 项目结构

```
ebook-converter/
├── index.html      # 页面结构
├── style.css       # 样式
├── script.js       # 上传 / 转换 / 下载 / 历史
├── README.md       # 本文档
└── LICENSE         # MIT License
```

## 🛠 实现说明

- 使用 [JSZip](https://stuk.github.io/jszip/) 在浏览器内解压和打包 EPUB
- 使用 [marked](https://marked.js.org/) 解析 Markdown
- 使用 `DOMParser` 解析 EPUB 的 `META-INF/container.xml` 与 OPF，按 `spine` 顺序提取章节
- TXT → EPUB：按常见章节标题（中文"第…章/回/卷/节/篇"、英文 "Chapter N"、Prologue / Epilogue）分章；未匹配则整文一章
- HTML / Markdown → EPUB：先清理 `<script>` / `<style>` / `<iframe>` 等不安全节点；优先按 `<h1>` 分章，若不足再按 `<h2>`
- 图片处理：data URI 内嵌图片解码后写入 `OEBPS/images/`；相对路径图片按文件名在"附带图片"里匹配后打包；外链 `http(s)://` 图片保留不下载（避免 CORS 与隐私问题）
- 封面：在 manifest 中加 `properties="cover-image"`（EPUB 3）并同步 `<meta name="cover">`（EPUB 2 兼容）；新建时还会生成 `cover.xhtml` 并放到 spine 第一位
- EPUB 元数据编辑：仅修改 OPF 中的 `dc:*` 元素和 `dcterms:modified`；替换封面时复用原封面 `href` 路径，避免破坏文档内引用；重新打包时确保 `mimetype` 仍是 zip 中第一个未压缩文件
- 转换历史保存在 `localStorage`，最多 10 条；渲染时进行 HTML 转义以避免文件名注入

## 🌐 离线 / 自托管 CDN（可选）

默认从 jsdelivr CDN 加载 JSZip 和 marked。若需要完全离线，把它们下载到本地：

```bash
mkdir -p vendor
curl -L -o vendor/jszip.min.js https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
curl -L -o vendor/marked.min.js https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js
```

然后修改 `index.html` 末尾的两行：

```html
<script src="vendor/jszip.min.js"></script>
<script src="vendor/marked.min.js"></script>
```

## 🧪 浏览器支持

需要支持 `File API`、`TextDecoder`、`DOMParser`、`crypto.randomUUID`：

- Chrome / Edge 92+
- Firefox 95+
- Safari 15.4+

## 🤝 贡献

欢迎 Issue 和 PR。后续计划：

- [ ] 简单 EPUB → PDF（轻量纯文字版）
- [ ] Markdown 扩展语法（GFM 表格 / 任务列表 / 代码高亮）
- [ ] 章节目录可视化编辑（手动调整顺序、合并/拆分）
- [ ] PWA 支持（离线可用）

## 📄 许可证

[MIT License](./LICENSE) © 2026
