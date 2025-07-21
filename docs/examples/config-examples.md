# 配置示例

## 🔧 LLM服务配置示例

### OpenAI GPT-4
```json
{
  "llmConfig": {
    "provider": "openai",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "apiKey": "sk-your-openai-api-key-here",
    "model": "gpt-4-vision-preview"
  }
}
```

### Azure OpenAI
```json
{
  "llmConfig": {
    "provider": "azure",
    "endpoint": "https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-12-01-preview",
    "apiKey": "your-azure-api-key-here",
    "model": "gpt-4-vision-preview"
  }
}
```

### Anthropic Claude
```json
{
  "llmConfig": {
    "provider": "anthropic",
    "endpoint": "https://api.anthropic.com/v1/messages",
    "apiKey": "your-anthropic-api-key-here",
    "model": "claude-3-opus-20240229"
  }
}
```

## 🎯 威胁建模平台配置

```json
{
  "threatModelingConfig": {
    "baseUrl": "https://your-threat-modeling-platform.com",
    "apiKey": "your-platform-api-key-here"
  }
}
```

## 📝 自定义分析提示词

```json
{
  "analysisConfig": {
    "defaultPrompt": "作为安全专家，请分析以下产品需求文档，识别潜在的安全风险和威胁场景。重点关注：数据安全、身份认证、权限控制、输入验证、业务逻辑安全等方面。请以结构化的JSON格式返回分析结果。"
  }
}
```

## 🔍 页面检测配置

```json
{
  "detectionConfig": {
    "customSelectors": [
      ".pingcode-attachment",
      ".requirement-files a",
      "[data-file-type='prd']",
      ".document-list .file-item"
    ]
  }
}
```

## 📋 完整配置示例

```json
{
  "llmConfig": {
    "provider": "openai",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "apiKey": "sk-your-api-key",
    "model": "gpt-4-vision-preview"
  },
  "threatModelingConfig": {
    "baseUrl": "https://your-platform.com",
    "apiKey": "your-platform-key"
  },
  "analysisConfig": {
    "defaultPrompt": "根据产品需求内容，识别潜在的安全风险点..."
  },
  "detectionConfig": {
    "customSelectors": [
      ".custom-attachment",
      ".requirement-content"
    ]
  }
}
```