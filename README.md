# 安全需求分析助手 Chrome 插件

一个智能的Chrome插件，用于自动解析产品需求文档并生成安全测试用例。专为DevOps平台（如PingCode）和威胁建模平台的集成而设计。

## 🚀 功能特性

### 核心功能
- **智能内容检测**: 自动检测页面中的PDF/DOCX附件和文本内容
- **多模态分析**: 利用支持多模态的LLM分析产品需求文档
- **安全场景识别**: 自动识别潜在的安全风险和威胁场景
- **测试用例生成**: 生成具体的安全测试场景和用例
- **平台集成**: 支持与威胁建模平台的API集成

### 智能检测
- 自动检测页面附件（PDF、DOCX、DOC）
- 智能识别产品需求相关文件
- 提取页面文本内容作为备选
- 支持手动输入需求内容
- 可配置的页面元素选择器

### 分析能力
- 数据流和关键资产识别
- 身份认证和授权需求分析
- 输入验证和数据处理风险评估
- 业务逻辑安全风险识别
- 结构化的安全测试场景输出

## 📦 安装方法

### 开发模式安装
1. 下载或克隆此项目到本地
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹
6. 插件安装完成

### 配置设置
1. 右键点击插件图标，选择"选项"
2. 配置LLM API设置（OpenAI、Azure OpenAI等）
3. 可选：配置威胁建模平台集成
4. 自定义分析提示词和页面选择器

## 🛠️ 快速开始

### 三步开始使用
1. **[安装插件](docs/guides/INSTALL.md)** - 按照详细指南安装和配置
2. **配置AI服务** - 设置OpenAI、Azure OpenAI或Anthropic API
3. **开始分析** - 在需求页面点击插件图标，一键分析

### 支持的平台
- PingCode、Jira、Confluence等需求管理平台
- 任何包含产品需求文档的网页
- 支持PDF/DOCX附件和页面文本内容

## ⚙️ 配置说明

### LLM配置
```json
{
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1/chat/completions",
  "apiKey": "your-api-key",
  "model": "gpt-4-vision-preview"
}
```

支持的LLM提供商：
- OpenAI GPT-4 Vision
- Azure OpenAI
- Anthropic Claude
- 自定义API端点

### 威胁建模平台集成
```json
{
  "baseUrl": "https://your-threat-platform.com",
  "apiKey": "your-platform-api-key"
}
```

### 自定义选择器
可以为特定网站添加自定义的CSS选择器：
```css
.custom-attachment-selector
.requirement-content-area
[data-file-type="prd"]
```

## 🔧 技术架构

### 核心组件
- **Content Script** (`content.js`): 页面内容检测和提取
- **Background Service** (`background.js`): LLM调用和数据处理
- **Popup Interface** (`popup.html/js`): 用户交互界面
- **Configuration Page** (`config.html/js`): 设置和配置管理

### 技术栈
- Chrome Extension Manifest V3
- 现代JavaScript (ES6+)
- Chrome Storage API
- Fetch API for LLM integration
- CSS3 for responsive UI

## 📋 分析输出格式

插件会生成结构化的安全分析报告：

```json
{
  "summary": "需求概述",
  "assets": ["关键资产列表"],
  "threats": [
    {
      "type": "威胁类型",
      "description": "威胁描述",
      "level": "风险等级",
      "impact": "影响范围"
    }
  ],
  "testScenarios": [
    {
      "category": "测试类别",
      "description": "测试场景描述",
      "steps": ["测试步骤"],
      "expectedResult": "预期结果"
    }
  ],
  "recommendations": ["安全建议列表"]
}
```

## 🔒 安全考虑

- API密钥本地加密存储
- 不会上传敏感的需求文档内容
- 支持本地LLM部署
- 可配置的数据处理策略

## 🚧 开发计划

### 即将推出的功能
- [ ] PDF/DOCX文件本地解析
- [ ] 更多LLM提供商支持
- [ ] 批量需求分析
- [ ] 分析结果导出功能
- [ ] 威胁模型可视化
- [ ] 团队协作功能

### 已知限制
- 当前版本不支持本地文件解析（需要手动复制内容）
- 部分复杂页面的内容检测可能不准确
- 需要稳定的网络连接进行LLM调用

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

### 开发环境设置
1. 克隆项目
2. 在Chrome中加载开发版本
3. 修改代码后重新加载插件
4. 测试功能并提交PR

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 📞 支持与贡献

### 获取帮助
- 📋 [提交Issue](https://github.com/nehcuh/security-requirements-analyzer/issues) - 报告问题或建议
- 💬 [GitHub Discussions](https://github.com/nehcuh/security-requirements-analyzer/discussions) - 讨论和问答
- 📖 [项目Wiki](https://github.com/nehcuh/security-requirements-analyzer/wiki) - 详细文档

### 贡献代码
- 🤝 查看 [贡献指南](CONTRIBUTING.md)
- 🔧 阅读 [调试指南](docs/guides/DEBUG.md)
- 📝 查看 [更新日志](CHANGELOG.md)
- 📚 浏览 [完整文档](docs/README.md)

### 项目状态
- ![GitHub release](https://img.shields.io/github/v/release/nehcuh/security-requirements-analyzer)
- ![GitHub issues](https://img.shields.io/github/issues/nehcuh/security-requirements-analyzer)
- ![GitHub stars](https://img.shields.io/github/stars/nehcuh/security-requirements-analyzer)
- ![License](https://img.shields.io/github/license/nehcuh/security-requirements-analyzer)

---

**注意**: 使用前请确保已正确配置LLM API密钥，并遵守相关服务的使用条款。

## ⭐ Star History

如果这个项目对你有帮助，请给我们一个Star！

[![Star History Chart](https://api.star-history.com/svg?repos=nehcuh/security-requirements-analyzer&type=Date)](https://star-history.com/#nehcuh/security-requirements-analyzer&Date)