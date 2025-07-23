// 页面控制台诊断工具 - 直接在目标页面的控制台运行
console.log("🔧 页面控制台诊断工具启动");

function pageConsoleDiagnosis() {
  console.log("=" .repeat(50));
  console.log("🔍 页面控制台诊断开始");
  console.log("=" .repeat(50));

  try {
    // 1. 基本页面信息
    console.log("\n📋 1. 页面基本信息");
    console.log("-".repeat(30));
    console.log("🌐 URL:", window.location.href);
    console.log("📄 标题:", document.title);
    console.log("⚡ 就绪状态:", document.readyState);
    console.log("🔢 DOM元素总数:", document.querySelectorAll('*').length);

    // 2. 链接分析
    console.log("\n📋 2. 链接分析");
    console.log("-".repeat(30));
    const allLinks = document.querySelectorAll('a');
    const pdfLinks = document.querySelectorAll('a[href*=".pdf"]');
    const docxLinks = document.querySelectorAll('a[href*=".docx"]');
    const docLinks = document.querySelectorAll('a[href*=".doc"]');
    const downloadLinks = document.querySelectorAll('a[download]');
    
    console.log("🔗 总链接数:", allLinks.length);
    console.log("📎 PDF链接:", pdfLinks.length);
    console.log("📎 DOCX链接:", docxLinks.length);
    console.log("📎 DOC链接:", docLinks.length);
    console.log("⬇️ 下载链接:", downloadLinks.length);

    // 显示前几个文件链接
    const fileLinks = document.querySelectorAll('a[href*=".pdf"], a[href*=".docx"], a[href*=".doc"], a[href*=".xlsx"], a[href*=".pptx"]');
    if (fileLinks.length > 0) {
      console.log("📎 检测到的文件链接:");
      Array.from(fileLinks).slice(0, 5).forEach((link, index) => {
        console.log(`  ${index + 1}. ${link.textContent?.trim() || '无文本'} -> ${link.href}`);
      });
      if (fileLinks.length > 5) {
        console.log(`  ... 还有 ${fileLinks.length - 5} 个文件链接`);
      }
    }

    // 3. Content Script状态检查
    console.log("\n📋 3. Content Script状态");
    console.log("-".repeat(30));
    console.log("🔧 SimpleContentDetector:", typeof window.SimpleContentDetector !== 'undefined' ? "✅ 已加载" : "❌ 未加载");
    console.log("🔧 detectPageContent函数:", typeof window.detectPageContent === 'function' ? "✅ 可用" : "❌ 不可用");

    // 4. 尝试手动检测
    console.log("\n📋 4. 手动检测测试");
    console.log("-".repeat(30));
    
    try {
      let detectionResult = null;
      
      if (typeof window.detectPageContent === 'function') {
        console.log("🔍 使用全局detectPageContent函数...");
        detectionResult = window.detectPageContent();
      } else if (typeof window.SimpleContentDetector !== 'undefined') {
        console.log("🔍 创建新的SimpleContentDetector实例...");
        const detector = new window.SimpleContentDetector();
        detectionResult = detector.detectAll();
      } else {
        console.log("❌ 没有可用的检测方法");
        
        // 尝试基本的DOM查询
        console.log("🔍 尝试基本DOM查询...");
        const basicAttachments = [];
        const selectors = [
          'a[href*=".pdf"]',
          'a[href*=".docx"]', 
          'a[href*=".doc"]',
          'a[href*=".xlsx"]',
          'a[href*=".pptx"]'
        ];
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            basicAttachments.push({
              name: el.textContent?.trim() || el.href.split('/').pop(),
              url: el.href,
              type: el.href.split('.').pop().toUpperCase()
            });
          });
        });
        
        console.log("📎 基本DOM查询结果:", basicAttachments.length, "个附件");
        basicAttachments.forEach((att, index) => {
          console.log(`  ${index + 1}. ${att.name} (${att.type})`);
        });
      }
      
      if (detectionResult) {
        if (detectionResult.error) {
          console.error("❌ 检测失败:", detectionResult.error);
        } else {
          console.log("✅ 检测成功!");
          console.log("  📎 附件数量:", detectionResult.totalCount || detectionResult.attachments?.length || 0);
          console.log("  📄 页面文本长度:", detectionResult.pageText?.length || 0);
          console.log("  ⏱️ 检测耗时:", detectionResult.detectionTime || '未知');
          
          if (detectionResult.attachments && detectionResult.attachments.length > 0) {
            console.log("  📎 检测到的附件详情:");
            detectionResult.attachments.forEach((att, index) => {
              console.log(`    ${index + 1}. ${att.name} (${att.type}) - ${att.size || '未知大小'}`);
            });
          }
        }
      }
      
    } catch (detectionError) {
      console.error("❌ 手动检测异常:", detectionError.message);
      console.error("📊 错误堆栈:", detectionError.stack);
    }

    // 5. 页面特征分析
    console.log("\n📋 5. 页面特征分析");
    console.log("-".repeat(30));
    
    const isPingCode = window.location.href.includes('pingcode.com');
    console.log("🏢 是否PingCode页面:", isPingCode ? "✅ 是" : "❌ 否");
    
    if (isPingCode) {
      console.log("🔍 PingCode特定元素检查:");
      console.log("  - .styx-pivot-detail-content-body:", document.querySelectorAll('.styx-pivot-detail-content-body').length);
      console.log("  - .thy-tabs:", document.querySelectorAll('.thy-tabs').length);
      console.log("  - atlas.pingcode.com链接:", document.querySelectorAll('a[href*="atlas.pingcode.com"]').length);
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎉 页面控制台诊断完成");
    console.log("=".repeat(50));

  } catch (error) {
    console.error("❌ 诊断过程出错:", error);
  }
}

// 运行诊断
pageConsoleDiagnosis();