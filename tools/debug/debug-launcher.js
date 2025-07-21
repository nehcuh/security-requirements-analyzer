// tools/debug/debug-launcher.js - 调试启动器
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class DebugLauncher {
    constructor() {
        this.projectRoot = path.join(__dirname, '../..');
        this.chromeProfileDir = path.join(this.projectRoot, '.chrome-profile');
    }

    async launch() {
        console.log('🚀 启动Chrome调试环境...');

        try {
            // 创建Chrome用户数据目录
            this.ensureChromeProfile();

            // 启动Chrome
            await this.launchChrome();

            console.log('✅ Chrome调试环境已启动');
            console.log('🔧 远程调试端口: 9222');
            console.log('📖 查看DEBUG.md获取更多调试信息');

        } catch (error) {
            console.error('❌ 启动失败:', error);
            process.exit(1);
        }
    }

    ensureChromeProfile() {
        if (!fs.existsSync(this.chromeProfileDir)) {
            fs.mkdirSync(this.chromeProfileDir, { recursive: true });
            console.log('📁 创建Chrome用户数据目录');
        }
    }

    async launchChrome() {
        const chromeArgs = [
            '--remote-debugging-port=9222',
            `--user-data-dir=${this.chromeProfileDir}`,
            `--load-extension=${this.projectRoot}`,
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            'chrome://extensions/'
        ];

        // 尝试不同的Chrome可执行文件路径
        const chromePaths = [
            'chrome',
            'google-chrome',
            'chromium',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ];

        let chromeProcess = null;

        for (const chromePath of chromePaths) {
            try {
                chromeProcess = spawn(chromePath, chromeArgs, {
                    detached: true,
                    stdio: 'ignore'
                });

                console.log(`🌐 Chrome已启动: ${chromePath}`);
                break;

            } catch (error) {
                continue;
            }
        }

        if (!chromeProcess) {
            throw new Error('无法找到Chrome可执行文件');
        }

        // 分离进程，避免阻塞
        chromeProcess.unref();
    }

    async attachDebugger() {
        console.log('🔗 连接调试器...');

        // 这里可以添加自动连接VS Code调试器的逻辑
        // 或者提供调试器连接指南

        console.log('💡 在VS Code中按F5启动调试器');
        console.log('🔍 或访问 chrome://inspect 进行调试');
    }

    showDebugInfo() {
        console.log('\n📋 调试信息:');
        console.log('- 项目根目录:', this.projectRoot);
        console.log('- Chrome配置目录:', this.chromeProfileDir);
        console.log('- 远程调试端口: 9222');
        console.log('- 扩展管理页面: chrome://extensions/');
        console.log('\n🛠️ 调试命令:');
        console.log('- 重新加载扩展: 在chrome://extensions/页面点击刷新');
        console.log('- 查看后台页面: 点击"检查视图"中的"背景页"');
        console.log('- 调试弹窗: 右键扩展图标 → "检查弹出内容"');
        console.log('- 调试内容脚本: 在目标页面按F12');
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const launcher = new DebugLauncher();

    // 解析命令行参数
    const args = process.argv.slice(2);

    if (args.includes('--info')) {
        launcher.showDebugInfo();
    } else {
        launcher.launch().then(() => {
            launcher.showDebugInfo();
        });
    }
}

module.exports = DebugLauncher;