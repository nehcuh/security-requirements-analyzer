/**
 * 共享配置管理器 - 统一管理LLM和威胁建模平台配置
 * 消除popup.js和config.js之间的重复代码
 */

export class SharedConfigManager {
  // 默认配置
  static getDefaultConfig() {
    return {
      provider: "custom",
      endpoint: "http://localhost:1234/v1/chat/completions",
      apiKey: "",
      model: "deepseek/deepseek-r1-0528-qwen3-8b"
    };
  }

  // LLM提供商配置模板
  static getProviderTemplates() {
    return {
      openai: {
        name: "OpenAI",
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4-vision-preview",
        requiresApiKey: true
      },
      azure: {
        name: "Azure OpenAI",
        endpoint: "https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-12-01-preview",
        model: "gpt-4-vision",
        requiresApiKey: true
      },
      anthropic: {
        name: "Anthropic Claude",
        endpoint: "https://api.anthropic.com/v1/messages",
        model: "claude-3-vision",
        requiresApiKey: true
      },
      custom: {
        name: "自定义LLM",
        endpoint: "http://localhost:1234/v1/chat/completions",
        model: "deepseek/deepseek-r1-0528-qwen3-8b",
        requiresApiKey: false
      }
    };
  }

  // 加载配置
  static async loadConfig() {
    try {
      const result = await chrome.storage.sync.get([
        "llmConfig",
        "threatModelingConfig"
      ]);

      const defaultConfig = this.getDefaultConfig();
      const llmConfig = result.llmConfig ? 
        { ...defaultConfig, ...result.llmConfig } : 
        defaultConfig;

      const threatModelingConfig = result.threatModelingConfig || {
        baseUrl: "",
        apiKey: ""
      };

      return {
        llmConfig,
        threatModelingConfig
      };
    } catch (error) {
      console.error("加载配置失败:", error);
      return {
        llmConfig: this.getDefaultConfig(),
        threatModelingConfig: { baseUrl: "", apiKey: "" }
      };
    }
  }

  // 保存配置
  static async saveConfig(config) {
    try {
      await chrome.storage.sync.set(config);
      return { success: true };
    } catch (error) {
      console.error("保存配置失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 配置验证
  static validateConfig(config) {
    const errors = [];
    const required = ["endpoint", "model"];
    
    // 检查必需字段
    required.forEach(field => {
      if (!config[field] || config[field].trim() === "") {
        errors.push(`${field} 不能为空`);
      }
    });

    // 验证端点URL格式
    if (config.endpoint) {
      try {
        new URL(config.endpoint);
      } catch (error) {
        errors.push("端点URL格式无效");
      }
    }

    // 检查API密钥要求 - 更严格的验证
    const provider = this.getProviderTemplates()[config.provider];
    if (provider && provider.requiresApiKey && (!config.apiKey || config.apiKey.trim() === "")) {
      errors.push(`${provider.name} 需要API密钥`);
    }

    // 对于自定义提供商，如果使用localhost，则不需要API密钥
    // 否则建议用户提供API密钥
    if (config.provider === "custom" && 
        config.endpoint && 
        !config.endpoint.includes("localhost") && 
        !config.endpoint.includes("127.0.0.1") && 
        (!config.apiKey || config.apiKey.trim() === "")) {
      errors.push("自定义远程LLM服务建议提供API密钥");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 获取缺失的配置字段
  static getMissingConfigFields(config) {
    const validation = this.validateConfig(config);
    return validation.errors;
  }

  // 测试LLM连接
  static async testLLMConnection(config) {
    try {
      const testPrompt = "请回复'连接测试成功'来确认API连接正常。";

      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` })
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "user",
              content: testPrompt,
            },
          ],
          max_tokens: 50,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          message: "连接测试成功",
          response: result
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `连接测试失败: ${error.message}`
      };
    }
  }

  // 应用提供商模板
  static applyProviderTemplate(provider) {
    const template = this.getProviderTemplates()[provider];
    if (!template) {
      return this.getDefaultConfig();
    }

    return {
      provider,
      endpoint: template.endpoint,
      model: template.model,
      apiKey: ""
    };
  }

  // 检查配置完整性
  static isConfigComplete(config) {
    const validation = this.validateConfig(config);
    return validation.isValid;
  }

  // 获取配置状态
  static getConfigStatus(config) {
    if (!config) {
      return { status: "未配置", message: "尚未配置LLM服务" };
    }

    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      return { 
        status: "配置不完整", 
        message: `缺少: ${validation.errors.join(", ")}` 
      };
    }

    return { status: "配置完成", message: "LLM配置正常" };
  }
}