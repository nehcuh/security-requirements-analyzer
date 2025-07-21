# 开发者指南

## 🚀 快速开始

### 环境要求
- Node.js 14.0.0+
- Chrome 88+
- Git

### 项目设置
```bash
# 1. 克隆项目
git clone https://github.com/nehcuh/security-requirements-analyzer.git
cd security-requirements-analyzer

# 2. 启动开发环境
npm run dev

# 3. 在Chrome中加载插件
# 访问 chrome://extensions/
# 开启开发者模式
# 点击"加载已解压的扩展程序"
# 选择项目根目录
```

## 📁 项目结构

```
security-requirements-analyzer/
├── 📦 src/                    # 源代码目录
│   ├── 🎯 content/           # 内容脚本 (页面内容检测)
│   ├── 🖥️ popup/             # 弹窗界面 (主要用户交互)
│   ├── ⚙️ config/            # 配置页面 (设置管理)
│   ├── 🔧 background/        # 后台服务 (API调用和数据处理)
│   ├── 🐛 debug/             # 调试工具 (开发辅助)
│   ├── 🔗 shared/            # 共享组件 (工具函数和常量)
│   └── 🎨 assets/            # 静态资源 (图标、样式等)
│
├── 🛠️ tools/                 # 开发工具
│   ├── build/               # 构建脚本
│   └── debug/               # 调试脚本
│
├── 📚 docs/                  # 文档
│   └── screenshots/         # 项目截图
│
├── 🐙 .github/               # GitHub配置
│   ├── ISSUE_TEMPLATE/      # Issue模板
│   └── pull_request_template.md
│
├── 📄 manifest.json          # Chrome扩展清单
├── 📋 package.json           # 项目配置
├── 🏗️ ARCHITECTURE.md        # 架构文档
└── 📖 README.md              # 项目说明
```

## 🔧 开发工作流

### 1. 日常开发
```bash
# 启动调试环境
npm run dev

# 修改代码后重新加载插件
# 在 chrome://extensions/ 页面点击刷新按钮
```

### 2. 构建发布
```bash
# 构建生产版本
npm run build

# 打包为zip文件
npm run package
```

### 3. 调试方法
```bash
# 显示调试信息
npm run debug:info

# 启动Chrome调试环境
npm run debug
```

## 🎯 核心模块开发

### Content Scripts (src/content/)
**职责**: 页面内容检测和提取
```javascript
// 主要API
class ContentDetector {
  detectAttachments()    // 检测附件
  detectPageText()       // 提取文本
  detectPageType()       // 识别页面类型
}
```

**开发要点**:
- 使用高效的CSS选择器
- 避免阻塞页面渲染
- 处理不同网站的兼容性

### Popup Interface (src/popup/)
**职责**: 用户交互界面
```javascript
// 主要API
class SecurityAnalysisPopup {
  init()                 // 初始化界面
  detectPageContent()    // 检测内容
  startAnalysis()        // 启动分析
  showAnalysisResult()   // 显示结果
}
```

**开发要点**:
- 响应式设计
- 用户体验优化
- 错误处理和反馈

### Background Service (src/background/)
**职责**: 后台服务和API集成
```javascript
// 主要API
class SecurityAnalysisService {
  analyzeContent()       // 分析内容
  callLLM()             // 调用LLM API
  parseFile()           // 解析文件
  updateConfig()        // 更新配置
}
```

**开发要点**:
- 异步处理
- 错误重试机制
- API限流和缓存

### Configuration (src/config/)
**职责**: 配置管理界面
```javascript
// 主要API
class ConfigManager {
  loadConfig()          // 加载配置
  saveConfig()          // 保存配置
  testConfig()          // 测试配置
  showQuickSetup()      // 快速设置
}
```

**开发要点**:
- 配置验证
- 用户引导
- 安全存储

## 🔍 调试指南

### Chrome DevTools调试
```bash
# 调试Content Scripts
1. 在目标页面按F12
2. 在Console中查看日志
3. 在Sources中设置断点

# 调试Background Service
1. 访问 chrome://extensions/
2. 点击"检查视图" → "背景页"
3. 在DevTools中调试

# 调试Popup
1. 右键插件图标
2. 选择"检查弹出内容"
3. 在DevTools中调试
```

### 内置调试工具
```javascript
// 在页面控制台中运行
debugExtension()              // 检查插件状态
DebugScripts.runAllTests()    // 运行所有测试
DebugScripts.testContentScript() // 测试内容检测

// 按 Ctrl+Shift+D 打开调试面板
```

### VS Code调试
```bash
# 1. 启动Chrome调试环境
npm run debug

# 2. 在VS Code中按F5
# 3. 选择"Attach to Chrome Extension"
# 4. 在代码中设置断点
```

## 🧪 测试策略

### 手动测试清单
- [ ] 插件正确加载
- [ ] 配置界面正常工作
- [ ] 内容检测功能正常
- [ ] LLM API调用成功
- [ ] 分析结果正确显示
- [ ] 错误处理机制有效

### 测试环境
- **开发环境**: 本地Chrome扩展
- **测试页面**: PingCode、Jira等需求管理平台
- **API测试**: 不同LLM服务提供商

### 性能测试
- 内容检测速度
- API响应时间
- 内存使用情况
- 用户界面响应性

## 📝 代码规范

### JavaScript规范
```javascript
// 使用ES6+语法
const config = await loadConfig();

// 使用驼峰命名
const analysisResult = await analyzeContent();

// 添加JSDoc注释
/**
 * 分析安全需求
 * @param {string} content - 需求内容
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeSecurityRequirements(content) {
  // 实现逻辑
}
```

### HTML/CSS规范
```html
<!-- 使用语义化标签 -->
<section class="analysis-section">
  <header class="section-header">
    <h3>分析结果</h3>
  </header>
  <main class="section-content">
    <!-- 内容 -->
  </main>
</section>
```

```css
/* 使用CSS变量 */
:root {
  --primary-color: #007cba;
  --border-radius: 4px;
}

/* 使用BEM命名 */
.analysis-section__header {
  color: var(--primary-color);
}
```

## 🔄 版本管理

### Git工作流
```bash
# 1. 创建功能分支
git checkout -b feature/new-feature

# 2. 提交代码
git add .
git commit -m "feat: add new feature"

# 3. 推送分支
git push origin feature/new-feature

# 4. 创建Pull Request
```

### 提交信息规范
```bash
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具变动
```

### 版本发布
```bash
# 1. 更新版本号
# 修改 manifest.json 和 package.json

# 2. 更新CHANGELOG.md
# 3. 创建Git标签
git tag v1.1.0

# 4. 推送标签
git push origin v1.1.0

# 5. 创建GitHub Release
```

## 🚀 部署指南

### Chrome Web Store发布
1. 构建生产版本: `npm run build`
2. 打包扩展: `npm run package`
3. 上传到Chrome Web Store
4. 填写扩展信息和截图
5. 提交审核

### 企业内部部署
1. 构建扩展包
2. 通过企业策略分发
3. 配置默认设置
4. 提供使用培训

## 🤝 贡献指南

### 提交代码前检查
- [ ] 代码遵循项目规范
- [ ] 添加了必要的注释
- [ ] 更新了相关文档
- [ ] 测试了新功能
- [ ] 没有破坏现有功能

### Code Review要点
- 代码质量和可读性
- 性能影响
- 安全考虑
- 用户体验
- 文档完整性

## 📞 获取帮助

### 文档资源
- [ARCHITECTURE.md](ARCHITECTURE.md) - 架构文档
- [DEBUG.md](DEBUG.md) - 调试指南
- [CONTRIBUTING.md](CONTRIBUTING.md) - 贡献指南

### 社区支持
- [GitHub Issues](https://github.com/nehcuh/security-requirements-analyzer/issues)
- [GitHub Discussions](https://github.com/nehcuh/security-requirements-analyzer/discussions)
- [项目Wiki](https://github.com/nehcuh/security-requirements-analyzer/wiki)

---

欢迎加入开发团队，一起改进这个项目！