// background-simple.js - 简化的后台服务脚本
// 用于解决Service Worker注册问题

class SecurityAnalysisService {
  constructor() {
    this.llmConfig = {
      apiKey: "",
      endpoint: "",
      model: "gpt-4-vision-preview",
    };

    this.threatModelingPlatform = {
      baseUrl: "",
      apiKey: "",
    };

    this.init();
  }

  init() {
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持异步响应通道开放
    });

    // 加载配置
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get([
        "llmConfig",
        "threatModelingConfig",
      ]);
      if (result.llmConfig) {
        this.llmConfig = { ...this.llmConfig, ...result.llmConfig };
      }
      if (result.threatModelingConfig) {
        this.threatModelingPlatform = {
          ...this.threatModelingPlatform,
          ...result.threatModelingConfig,
        };
      }
    } catch (error) {
      console.error("加载配置失败:", error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      // Handle diagnostic ping without validation for debugging
      if (request.action === "diagnostic-ping") {
        sendResponse({
          success: true,
          message: "Background service is active",
          timestamp: new Date().toISOString(),
          receivedTimestamp: request.timestamp,
        });
        return;
      }

      switch (request.action) {
        case "analyzeContent":
          const analysisResult = await this.analyzeContent(request.data);
          sendResponse({ success: true, data: analysisResult });
          break;

        case "parseFile":
          const fileContent = await this.parseFile(request.data);
          sendResponse({ success: true, content: fileContent });
          break;

        case "updateConfig":
          await this.updateConfig(request.data);
          sendResponse({ success: true });
          break;

        case "testLLMConnection":
          const testResult = await this.testLLMConnection(request.data);
          sendResponse(testResult);
          break;

        default:
          sendResponse({ success: false, error: "未知操作" });
      }
    } catch (error) {
      console.error("处理消息失败:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async analyzeContent(data) {
    const { content, prompt, source } = data;

    // 构建分析请求
    const analysisPrompt = this.buildAnalysisPrompt(content, prompt);

    // 调用LLM进行分析
    const llmResult = await this.callLLM(analysisPrompt, content);

    // 解析安全场景
    const securityScenarios = this.parseSecurityScenarios(llmResult);

    // 可选：发送到威胁建模平台
    if (this.threatModelingPlatform.baseUrl) {
      await this.sendToThreatModelingPlatform(securityScenarios);
    }

    return {
      originalContent: content,
      analysis: llmResult,
      securityScenarios,
      timestamp: new Date().toISOString(),
    };
  }

  buildAnalysisPrompt(content, customPrompt) {
    const defaultPrompt = `
请对以下产品需求内容进行安全分析，识别潜在的安全威胁和风险点，并生成相应的测试场景。

分析要求：
1. 识别关键资产和数据流
2. 分析身份认证和授权需求
3. 评估输入验证和数据处理风险
4. 识别业务逻辑安全风险
5. 提供具体的安全测试场景

请以JSON格式返回结果，包含以下字段：
- summary: 需求概述
- assets: 关键资产列表
- threats: 威胁列表（包含类型、描述、风险等级）
- testScenarios: 测试场景列表
- recommendations: 安全建议

产品需求内容：`;

    return (customPrompt || defaultPrompt) + "\n\n" + JSON.stringify(content);
  }

  async callLLM(prompt, content) {
    if (!this.llmConfig.apiKey) {
      throw new Error("请先配置LLM API密钥");
    }

    try {
      const response = await fetch(this.llmConfig.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: this.llmConfig.model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API调用失败: ${response.status}`);
      }

      const result = await response.json();
      return result.choices[0].message.content;
    } catch (error) {
      console.error("LLM调用失败:", error);
      throw error;
    }
  }

  parseSecurityScenarios(llmResult) {
    try {
      return JSON.parse(llmResult);
    } catch (error) {
      // 如果不是JSON格式，进行文本解析
      return {
        summary: "需求分析",
        analysis: llmResult,
        threats: this.extractThreats(llmResult),
        testScenarios: this.extractTestScenarios(llmResult),
      };
    }
  }

  extractThreats(text) {
    const threats = [];
    const lines = text.split("\n");

    lines.forEach((line) => {
      if (
        line.includes("威胁") ||
        line.includes("风险") ||
        line.includes("threat")
      ) {
        threats.push({
          description: line.trim(),
          level: this.assessThreatLevel(line),
        });
      }
    });

    return threats;
  }

  extractTestScenarios(text) {
    const scenarios = [];
    const lines = text.split("\n");

    lines.forEach((line) => {
      if (
        line.includes("测试") ||
        line.includes("验证") ||
        line.includes("test")
      ) {
        scenarios.push({
          description: line.trim(),
          type: "security_test",
        });
      }
    });

    return scenarios;
  }

  assessThreatLevel(text) {
    const highKeywords = ["严重", "高危", "critical", "high"];
    const mediumKeywords = ["中等", "medium"];

    const lowerText = text.toLowerCase();

    if (highKeywords.some((keyword) => lowerText.includes(keyword))) {
      return "high";
    } else if (mediumKeywords.some((keyword) => lowerText.includes(keyword))) {
      return "medium";
    }

    return "low";
  }

  async parseFile(attachment) {
    try {
      // 简单的文件解析实现
      return `文件内容解析: ${attachment.name}`;
    } catch (error) {
      throw new Error(`文件解析失败: ${error.message}`);
    }
  }

  async sendToThreatModelingPlatform(scenarios) {
    if (!this.threatModelingPlatform.baseUrl) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.threatModelingPlatform.baseUrl}/api/scenarios`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.threatModelingPlatform.apiKey}`,
          },
          body: JSON.stringify(scenarios),
        },
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("发送到威胁建模平台失败:", error);
    }

    return null;
  }

  async updateConfig(data) {
    await chrome.storage.sync.set(data);
    await this.loadConfig();
  }

  async testLLMConnection(llmConfig) {
    try {
      const testPrompt = "请回复'连接测试成功'来确认API连接正常。";

      const response = await fetch(llmConfig.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: "user",
              content: testPrompt,
            },
          ],
          max_tokens: 50,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API调用失败 (${response.status}): ${errorText}`,
        };
      }

      const result = await response.json();

      if (result.choices && result.choices[0] && result.choices[0].message) {
        return {
          success: true,
          message: "连接测试成功",
          response: result.choices[0].message.content,
        };
      } else {
        return {
          success: false,
          error: "响应格式不正确: " + JSON.stringify(result),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `连接测试失败: ${error.message}`,
      };
    }
  }
}

// 创建服务实例
const securityAnalysisService = new SecurityAnalysisService();
