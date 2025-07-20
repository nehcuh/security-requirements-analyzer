# GitHub仓库设置指南

## 🏷️ 仓库信息

### 仓库名称
`security-requirements-analyzer`

### 仓库描述
```
🛡️ AI-powered Chrome extension for automated security requirements analysis and threat modeling from product requirement documents
```

### 仓库标签 (Topics)
```
chrome-extension
security-analysis
threat-modeling
ai-assistant
requirements-analysis
devops-tools
security-testing
llm-integration
javascript
manifest-v3
openai
azure-openai
anthropic
pingcode
security-automation
```

### 仓库设置建议

#### 基本设置
- **Visibility**: Public
- **Include a README file**: ✅ (已有)
- **Add .gitignore**: ✅ (已创建)
- **Choose a license**: MIT License ✅ (已创建)

#### 功能设置
- **Issues**: ✅ 启用 (用于bug报告和功能请求)
- **Projects**: ✅ 启用 (用于项目管理)
- **Wiki**: ✅ 启用 (用于详细文档)
- **Discussions**: ✅ 启用 (用于社区讨论)
- **Sponsorships**: 可选
- **Security**: ✅ 启用安全策略

#### 分支保护
- **Protect main branch**: ✅
- **Require pull request reviews**: ✅
- **Require status checks**: ✅
- **Restrict pushes**: ✅

## 📋 创建仓库步骤

### 方法1: GitHub网页创建
1. 访问 https://github.com/new
2. 填写仓库信息：
   - Repository name: `security-requirements-analyzer`
   - Description: 上述描述
   - Public repository
   - 不勾选初始化文件（我们已有完整项目）

3. 创建后推送代码：
   ```bash
   git init
   git add .
   git commit -m "feat: initial release of security requirements analyzer chrome extension"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/security-requirements-analyzer.git
   git push -u origin main
   ```

### 方法2: GitHub CLI创建
```bash
# 安装GitHub CLI后
gh repo create security-requirements-analyzer --public --description "🛡️ AI-powered Chrome extension for automated security requirements analysis and threat modeling"

# 推送代码
git init
git add .
git commit -m "feat: initial release of security requirements analyzer chrome extension"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/security-requirements-analyzer.git
git push -u origin main
```

## 🏷️ 发布第一个版本

### 创建Release
1. 在GitHub仓库页面点击 "Releases"
2. 点击 "Create a new release"
3. 填写信息：
   - Tag version: `v1.0.0`
   - Release title: `🎉 Initial Release - Security Requirements Analyzer v1.0.0`
   - Description: 参考CHANGELOG.md内容

### Release描述模板
```markdown
## 🎉 首次发布！

安全需求分析助手Chrome插件正式发布！这是一个AI驱动的智能工具，专为自动化安全需求分析和威胁建模而设计。

### ✨ 主要功能
- 🤖 支持多种LLM服务（OpenAI、Azure OpenAI、Anthropic）
- 📎 智能检测页面附件和文本内容
- 🛡️ 自动生成安全威胁分析和测试场景
- ⚙️ 用户友好的配置界面
- 📊 结构化分析结果展示

### 🚀 快速开始
1. 下载并解压项目文件
2. 在Chrome中加载插件（开发者模式）
3. 配置AI服务API密钥
4. 在需求页面使用插件进行分析

### 📖 文档
- [安装指南](INSTALL.md)
- [使用说明](README.md)
- [调试文档](DEBUG.md)

### 🤝 贡献
欢迎提交Issue和Pull Request！查看[贡献指南](CONTRIBUTING.md)了解详情。

**完整更新日志**: [CHANGELOG.md](CHANGELOG.md)
```

## 🔧 仓库配置文件

### Issue模板
创建 `.github/ISSUE_TEMPLATE/` 文件夹和模板文件

### Pull Request模板
创建 `.github/pull_request_template.md`

### GitHub Actions
可选：创建 `.github/workflows/` 用于CI/CD

### 安全策略
创建 `SECURITY.md` 文件

## 📊 项目管理

### 建议的Labels
- `bug` - 问题报告
- `enhancement` - 功能增强
- `documentation` - 文档相关
- `good first issue` - 适合新手
- `help wanted` - 需要帮助
- `question` - 问题咨询
- `wontfix` - 不会修复
- `duplicate` - 重复问题

### 项目看板
创建项目看板管理开发进度：
- **Backlog** - 待办事项
- **In Progress** - 进行中
- **Review** - 代码审查
- **Done** - 已完成

---

按照这个指南设置GitHub仓库，可以确保项目的专业性和可维护性。
```