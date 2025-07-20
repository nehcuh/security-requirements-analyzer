# 贡献指南

感谢你对安全需求分析助手Chrome插件的关注！我们欢迎各种形式的贡献。

## 🤝 如何贡献

### 报告问题
- 使用GitHub Issues报告bug
- 提供详细的复现步骤
- 包含浏览器版本和插件版本信息
- 如果可能，提供错误截图或日志

### 功能建议
- 在Issues中提出新功能建议
- 详细描述功能需求和使用场景
- 讨论实现方案的可行性

### 代码贡献
1. Fork这个仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 🛠️ 开发环境设置

### 前置要求
- Chrome浏览器 (版本88+)
- 基本的JavaScript/HTML/CSS知识
- Git版本控制

### 本地开发
1. 克隆仓库
   ```bash
   git clone https://github.com/your-username/security-requirements-analyzer.git
   cd security-requirements-analyzer
   ```

2. 在Chrome中加载插件
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目文件夹

3. 开始开发
   - 修改代码后在扩展管理页面点击刷新
   - 使用内置调试工具进行测试

### 调试
- 运行 `start-debug.bat` 启动调试环境
- 查看 `DEBUG.md` 了解详细调试方法
- 使用Chrome DevTools进行调试

## 📝 代码规范

### JavaScript
- 使用ES6+语法
- 遵循驼峰命名法
- 添加适当的注释
- 保持函数简洁，单一职责

### HTML/CSS
- 使用语义化HTML标签
- CSS类名使用kebab-case
- 保持响应式设计
- 确保无障碍访问

### 提交信息
使用清晰的提交信息格式：
```
类型(范围): 简短描述

详细描述（可选）

相关Issue: #123
```

类型包括：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

## 🧪 测试

### 手动测试
- 在不同网站测试内容检测功能
- 验证各种LLM服务的集成
- 测试配置保存和加载
- 检查错误处理机制

### 测试清单
- [ ] 插件正确加载
- [ ] 配置界面正常工作
- [ ] 内容检测功能正常
- [ ] LLM API调用成功
- [ ] 分析结果正确显示
- [ ] 错误处理机制有效

## 📋 Pull Request检查清单

提交PR前请确认：
- [ ] 代码遵循项目规范
- [ ] 添加了必要的注释
- [ ] 更新了相关文档
- [ ] 测试了新功能
- [ ] 没有破坏现有功能
- [ ] 提交信息清晰明确

## 🏷️ 版本发布

版本发布由维护者负责：
1. 更新版本号（manifest.json）
2. 更新CHANGELOG.md
3. 创建Git标签
4. 发布GitHub Release
5. 可选：提交到Chrome Web Store

## 📞 联系方式

- GitHub Issues: 报告问题和功能建议
- Discussions: 一般讨论和问答
- Email: [维护者邮箱]

## 📄 许可证

通过贡献代码，你同意你的贡献将在MIT许可证下发布。

---

再次感谢你的贡献！每一个贡献都让这个项目变得更好。