# 📁 项目结构

## 🏗️ 目录结构

```
security-requirements-analyzer/
├── 📄 项目文件
│   ├── README.md                    # 项目主页
│   ├── manifest.json               # Chrome扩展清单
│   ├── CHANGELOG.md                # 更新日志
│   ├── CONTRIBUTING.md             # 贡献指南
│   ├── SECURITY.md                 # 安全策略
│   ├── LICENSE                     # 开源许可证
│   └── PROJECT_STRUCTURE.md        # 本文档
│
├── 📂 源代码 (src/)
│   ├── popup/                      # 弹窗界面
│   │   ├── popup.html             # 弹窗HTML
│   │   └── popup.js               # 弹窗逻辑
│   ├── content/                    # 内容脚本
│   │   └── content.js             # 页面内容检测
│   ├── background/                 # 后台服务
│   │   └── background.js          # 后台处理逻辑
│   ├── config/                     # 配置页面
│   │   ├── config.html            # 配置界面
│   │   └── config.js              # 配置逻辑
│   ├── debug/                      # 调试工具
│   │   ├── debug-helper.js        # 调试辅助
│   │   └── debug-scripts.js       # 调试脚本
│   ├── shared/                     # 共享组件
│   │   ├── constants.js           # 常量定义
│   │   └── utils.js               # 工具函数
│   └── assets/                     # 静态资源
│       └── (图标、样式等)
│
├── 📚 文档 (docs/)
│   ├── README.md                   # 文档索引
│   ├── ARCHITECTURE.md             # 项目架构
│   ├── guides/                     # 使用指南
│   │   ├── INSTALL.md             # 安装指南
│   │   └── DEBUG.md               # 调试指南
│   ├── examples/                   # 配置示例
│   │   └── config-examples.md     # 配置示例
│   ├── api/                        # API文档
│   └── screenshots/                # 项目截图
│       └── README.md
│
├── 🛠️ 开发工具 (tools/)
│   ├── build/                      # 构建脚本
│   │   └── build.js               # 构建工具
│   └── debug/                      # 调试工具
│       ├── debug-launcher.js      # 调试启动器
│       └── start-debug.bat        # 快速启动脚本
│
├── ⚙️ 配置文件
│   ├── .gitignore                 # Git忽略文件
│   ├── .vscode/                   # VS Code配置
│   │   ├── launch.json           # 调试配置
│   │   ├── tasks.json            # 任务配置
│   │   └── settings.json         # 编辑器设置
│   └── .github/                   # GitHub配置
│       ├── ISSUE_TEMPLATE/        # Issue模板
│       └── pull_request_template.md
│
└── 🔧 其他
    ├── .git/                      # Git版本控制
    └── .kiro/                     # Kiro IDE配置
```

## 🎯 核心模块说明

### 用户界面层
- **popup/**: 插件主界面，用户交互入口
- **config/**: 配置管理界面，AI服务设置

### 功能逻辑层
- **content/**: 页面内容检测，附件和文本提取
- **background/**: 后台服务，API调用和数据处理

### 支持工具层
- **debug/**: 开发调试工具
- **shared/**: 共享组件和工具函数

## 📋 文件说明

### 关键文件
| 文件                           | 作用           | 重要性 |
| ------------------------------ | -------------- | ------ |
| `manifest.json`                | Chrome扩展配置 | 🔴 必需 |
| `src/popup/popup.html`         | 主界面         | 🔴 必需 |
| `src/background/background.js` | 后台服务       | 🔴 必需 |
| `src/content/content.js`       | 内容检测       | 🔴 必需 |

### 配置文件
| 文件                      | 作用     | 重要性 |
| ------------------------- | -------- | ------ |
| `src/config/config.html`  | 配置界面 | 🟡 重要 |
| `src/shared/constants.js` | 常量定义 | 🟡 重要 |
| `.vscode/launch.json`     | 调试配置 | 🟢 可选 |

### 文档文件
| 文件                     | 作用     | 读者     |
| ------------------------ | -------- | -------- |
| `README.md`              | 项目介绍 | 所有用户 |
| `docs/guides/INSTALL.md` | 安装指南 | 新用户   |
| `docs/ARCHITECTURE.md`   | 技术架构 | 开发者   |
| `CONTRIBUTING.md`        | 贡献指南 | 贡献者   |

## 🚀 开发工作流

### 新手入门
1. 阅读 `README.md` 了解项目
2. 按照 `docs/guides/INSTALL.md` 安装
3. 查看 `docs/ARCHITECTURE.md` 了解架构
4. 运行 `tools/debug/start-debug.bat` 开始调试

### 日常开发
1. 修改 `src/` 目录下的源代码
2. 在Chrome中刷新插件
3. 使用调试工具测试功能
4. 提交代码前运行构建脚本

### 发布流程
1. 更新 `CHANGELOG.md`
2. 运行 `tools/build/build.js` 构建
3. 测试构建结果
4. 创建GitHub Release

## 📝 维护指南

### 添加新功能
1. 在相应的 `src/` 子目录中添加代码
2. 更新 `manifest.json` 如需要
3. 添加相应的文档
4. 更新测试用例

### 更新文档
1. 修改相应的Markdown文件
2. 更新 `docs/README.md` 索引
3. 确保链接正确
4. 提交文档更新

---

📅 **更新时间**: 2025-01-20  
📖 **文档版本**: v1.0.0  
🔄 **维护状态**: 积极维护