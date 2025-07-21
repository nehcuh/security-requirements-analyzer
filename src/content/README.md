# Content Scripts Module

## 📋 模块概述

Content Scripts模块负责在网页中检测和提取产品需求相关的内容，包括附件链接和文本内容。

## 📁 文件结构

```
src/content/
├── content.js          # 主要内容检测脚本
└── README.md          # 本文档
```

## 🎯 主要功能

### 1. 附件检测
- 检测页面中的PDF、DOCX、DOC文件链接
- 支持多种需求管理平台的附件格式
- 智能识别产品需求相关文件

### 2. 文本内容提取
- 提取页面中的需求描述文本
- 支持富文本编辑器内容
- 过滤无关内容，聚焦需求信息

### 3. 页面类型识别
- 判断是否为需求管理页面
- 识别不同平台的页面特征
- 提供页面适配建议

## 🔧 技术实现

### 核心类：ContentDetector
```javascript
class ContentDetector {
  detectAttachments()    // 检测附件
  detectPageText()       // 检测文本内容
  detectPageType()       // 检测页面类型
}
```

### 选择器配置
- **通用选择器**: 适用于大多数网站
- **平台特定选择器**: 针对PingCode、Jira等平台优化
- **自定义选择器**: 支持用户配置

## 📡 消息通信

### 接收消息
- `detectContent`: 检测页面内容请求

### 返回数据格式
```javascript
{
  attachments: [
    {
      url: "文件URL",
      name: "文件名",
      type: "文件类型",
      size: "文件大小"
    }
  ],
  pageText: "页面文本内容",
  pageType: {
    isPingCode: boolean,
    isRequirementPage: boolean,
    hasAttachments: boolean,
    hasTextContent: boolean
  },
  url: "页面URL",
  title: "页面标题"
}
```

## 🛠️ 开发指南

### 添加新平台支持
1. 在`attachmentSelectors`中添加平台特定选择器
2. 在`textContentSelectors`中添加文本内容选择器
3. 更新`detectPageType`方法识别新平台

### 调试方法
1. 在目标页面打开开发者工具
2. 在Console中运行调试命令
3. 查看内容检测结果

### 性能优化
- 使用高效的CSS选择器
- 避免过度的DOM查询
- 实现内容缓存机制

## 🔍 支持的平台

### 已测试平台
- PingCode
- Jira
- Confluence
- 通用网页

### 待支持平台
- Teambition
- Tower
- Worktile
- 其他需求管理工具

## 🐛 常见问题

### Q: 检测不到附件
- 检查页面是否完全加载
- 验证附件链接格式
- 添加自定义选择器

### Q: 文本内容不准确
- 调整文本选择器优先级
- 过滤无关内容
- 优化内容提取逻辑

## 📝 更新日志

- v1.0.0: 初始版本，支持基础内容检测
- 后续版本将添加更多平台支持和优化