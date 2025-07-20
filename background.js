// background.js - 后台服务脚本
class SecurityAnalysisService {
  constructor() {
    this.llmConfig = {
      apiKey: '', // 需要用户配置
      endpoint: '', // LLM API端点
      model: 'gpt-4-vision-preview' // 支持多模态的模型
    };
    
    this.threatModelingPlatform = {
      baseUrl: '', // 威胁建模平台地址
      apiKey: '' // 平台API密钥
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
      const result = await chrome.storage.sync.get(['llmConfig', 'threatModelingConfig']);
      if (result.llmConfig) {
        this.llmConfig = { ...this.llmConfig, ...result.llmConfig };
      }
      if (result.threatModelingConfig) {
        this.threatModelingPlatform = { ...this.threatModelingPlatform, ...result.threatModelingConfig };
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'analyzeContent':
          const analysisResult = await this.analyzeContent(request.data);
          sendResponse({ success: true, data: analysisResult });
          break;

        case 'parseFile':
          const fileContent = await this.parseFile(request.data);
          sendResponse({ success: true, content: fileContent });
          break;

        case 'updateConfig':
          await this.updateConfig(request.data);
          sendResponse({ success: true });
          break;

        case 'testLLMConnection':
          const testResult = await this.testLLMConnection(request.data);
          sendResponse(testResult);
          break;

        default:
          sendResponse({ success: false, error: '未知操作' });
      }
    } catch (error) {
      console.error('处理消息失败:', error);
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
      timestamp: new Date().toISOString()
    };
  }

  buildAnalysisPrompt(content, customPrompt) {
    const defaultPrompt = `
作为安全专家，请分析以下产品需求文档，识别潜在的安全风险和威胁场景：

分析要求：
1. 识别数据流和关键资产
2. 分析身份认证和授权需求
3. 评估输入验证和数据处理风险
4. 识别业务逻辑安全风险
5. 提出具体的安全测试场景

请以JSON格式返回分析结果，包含以下字段：
- summary: 需求概述
- assets: 关键资产列表
- threats: 威胁列表（每个威胁包含类型、描述、风险等级）
- testScenarios: 安全测试场景列表
- recommendations: 安全建议

产品需求内容：
`;

    return (customPrompt || defaultPrompt) + '\n\n' + JSON.stringify(content);
  }

  async callLLM(prompt, content) {
    if (!this.llmConfig.apiKey) {
      throw new Error('请先配置LLM API密钥');
    }

    // 这里是示例实现，需要根据实际使用的LLM服务调整
    const response = await fetch(this.llmConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.llmConfig.apiKey}`
      },
      body: JSON.stringify({
        model: this.llmConfig.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API调用失败: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  }

  parseSecurityScenarios(llmResult) {
    try {
      // 尝试解析JSON格式的结果
      const parsed = JSON.parse(llmResult);
      return parsed;
    } catch (error) {
      // 如果不是JSON格式，进行文本解析
      return {
        summary: '需求分析',
        analysis: llmResult,
        threats: this.extractThreats(llmResult),
        testScenarios: this.extractTestScenarios(llmResult)
      };
    }
  }

  extractThreats(text) {
    // 简单的威胁提取逻辑
    const threats = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('威胁') || line.includes('风险') || line.includes('threat')) {
        threats.push({
          description: line.trim(),
          level: this.assessThreatLevel(line)
        });
      }
    });

    return threats;
  }

  extractTestScenarios(text) {
    // 简单的测试场景提取逻辑
    const scenarios = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('测试') || line.includes('验证') || line.includes('test')) {
        scenarios.push({
          description: line.trim(),
          type: 'security_test'
        });
      }
    });

    return scenarios;
  }

  assessThreatLevel(text) {
    const highKeywords = ['严重', '高危', 'critical', 'high'];
    const mediumKeywords = ['中等', 'medium'];
    
    const lowerText = text.toLowerCase();
    
    if (highKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'high';
    } else if (mediumKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'medium';
    }
    
    return 'low';
  }

  async parseFile(attachment) {
    const { url, type } = attachment;
    
    try {
      // 下载文件
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`文件下载失败: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // 根据文件类型解析
      switch (type.toLowerCase()) {
        case 'pdf':
          return await this.parsePDF(arrayBuffer);
        case 'docx':
          return await this.parseDOCX(arrayBuffer);
        case 'doc':
          return await this.parseDOC(arrayBuffer);
        default:
          throw new Error(`不支持的文件类型: ${type}`);
      }
    } catch (error) {
      throw new Error(`文件解析失败: ${error.message}`);
    }
  }

  async parsePDF(arrayBuffer) {
    // 这里需要集成PDF.js或类似库
    // 由于Chrome扩展的限制，可能需要使用web worker
    return '暂不支持PDF解析，请使用手动输入或页面文本内容';
  }

  async parseDOCX(arrayBuffer) {
    // 这里需要集成mammoth.js或类似库
    return '暂不支持DOCX解析，请使用手动输入或页面文本内容';
  }

  async parseDOC(arrayBuffer) {
    // DOC格式解析更复杂，可能需要服务端支持
    return '暂不支持DOC解析，请使用手动输入或页面文本内容';
  }

  async sendToThreatModelingPlatform(scenarios) {
    if (!this.threatModelingPlatform.baseUrl) {
      return null;
    }

    try {
      const response = await fetch(`${this.threatModelingPlatform.baseUrl}/api/scenarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.threatModelingPlatform.apiKey}`
        },
        body: JSON.stringify(scenarios)
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('发送到威胁建模平台失败:', error);
    }

    return null;
  }

  async updateConfig(config) {
    await chrome.storage.sync.set(config);
    await this.loadConfig();
  }

  async testLLMConnection(llmConfig) {
    try {
      const testPrompt = "请回复'连接测试成功'来确认API连接正常。";
      
      const response = await fetch(llmConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: 'user',
              content: testPrompt
            }
          ],
          max_tokens: 50,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { 
          success: false, 
          error: `API调用失败 (${response.status}): ${errorText}` 
        };
      }

      const result = await response.json();
      
      if (result.choices && result.choices[0] && result.choices[0].message) {
        return { 
          success: true, 
          message: '连接测试成功',
          response: result.choices[0].message.content 
        };
      } else {
        return { 
          success: false, 
          error: '响应格式不正确: ' + JSON.stringify(result) 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `连接测试失败: ${error.message}` 
      };
    }
  }
}

// 初始化服务
new SecurityAnalysisService();