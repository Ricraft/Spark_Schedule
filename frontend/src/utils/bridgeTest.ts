/**
 * 前端 Bridge 连接测试工具
 */

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'timeout';
  duration: number;
  details?: any;
  error?: string;
}

class BridgeTestSuite {
  private results: TestResult[] = [];

  async runAllTests(): Promise<TestResult[]> {
    console.log('🚀 开始前端 Bridge 测试套件');
    
    this.results = [];
    
    await this.testBridgeAvailability();
    await this.testQWebChannelConnection();
    await this.testBasicMethods();
    await this.testGetCourses();
    await this.testInitApp();
    await this.testHealthCheck();
    await this.testConcurrentCalls();
    
    this.printSummary();
    return this.results;
  }

  private async testBridgeAvailability(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const bridge = (window as any).pyBridge;
      const duration = Date.now() - startTime;
      
      if (bridge) {
        this.results.push({
          name: 'Bridge 可用性',
          status: 'success',
          duration,
          details: {
            type: typeof bridge,
            methods: Object.getOwnPropertyNames(bridge).filter(name => typeof bridge[name] === 'function').slice(0, 10)
          }
        });
      } else {
        this.results.push({
          name: 'Bridge 可用性',
          status: 'error',
          duration,
          error: 'pyBridge 不存在'
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Bridge 可用性',
        status: 'error',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testQWebChannelConnection(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const hasQt = !!(window as any).qt;
      const hasWebChannel = !!(window as any).QWebChannel;
      const hasTransport = !!(window as any).qt?.webChannelTransport;
      
      this.results.push({
        name: 'QWebChannel 连接',
        status: hasQt && hasWebChannel && hasTransport ? 'success' : 'error',
        duration: Date.now() - startTime,
        details: {
          hasQt,
          hasWebChannel,
          hasTransport
        },
        error: !hasQt ? 'Qt 环境不可用' : !hasWebChannel ? 'QWebChannel 不可用' : !hasTransport ? 'webChannelTransport 不可用' : undefined
      });
    } catch (error) {
      this.results.push({
        name: 'QWebChannel 连接',
        status: 'error',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testBasicMethods(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge) {
        throw new Error('Bridge 不可用');
      }

      const methods = ['get_courses', 'init_app', 'save_course', 'delete_course_by_id'];
      const availableMethods = methods.filter(method => typeof bridge[method] === 'function');
      
      this.results.push({
        name: '基础方法检查',
        status: availableMethods.length === methods.length ? 'success' : 'error',
        duration: Date.now() - startTime,
        details: {
          expected: methods,
          available: availableMethods,
          missing: methods.filter(m => !availableMethods.includes(m))
        }
      });
    } catch (error) {
      this.results.push({
        name: '基础方法检查',
        status: 'error',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testGetCourses(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge || typeof bridge.get_courses !== 'function') {
        throw new Error('get_courses 方法不可用');
      }

      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('操作超时')), 10000); // 10秒超时
      });

      const result = await Promise.race([
        bridge.get_courses(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      
      let parsedData = null;
      let dataLength = 0;
      
      if (typeof result === 'string') {
        try {
          parsedData = JSON.parse(result);
          dataLength = Array.isArray(parsedData) ? parsedData.length : 0;
        } catch (e) {
          // JSON 解析失败，但调用成功
        }
      }

      this.results.push({
        name: 'get_courses 调用',
        status: 'success',
        duration,
        details: {
          resultType: typeof result,
          resultLength: result?.length || 0,
          dataLength,
          isValidJSON: parsedData !== null
        }
      });
    } catch (error) {
      this.results.push({
        name: 'get_courses 调用',
        status: error instanceof Error && error.message === '操作超时' ? 'timeout' : 'error',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testInitApp(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge || typeof bridge.init_app !== 'function') {
        throw new Error('init_app 方法不可用');
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('操作超时')), 5000);
      });

      await Promise.race([
        bridge.init_app(),
        timeoutPromise
      ]);

      this.results.push({
        name: 'init_app 调用',
        status: 'success',
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.results.push({
        name: 'init_app 调用',
        status: error instanceof Error && error.message === '操作超时' ? 'timeout' : 'error',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge || typeof bridge.check_bridge_health !== 'function') {
        this.results.push({
          name: '健康检查',
          status: 'error',
          duration: Date.now() - startTime,
          error: 'check_bridge_health 方法不可用'
        });
        return;
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('操作超时')), 5000);
      });

      const result = await Promise.race([
        bridge.check_bridge_health(),
        timeoutPromise
      ]);

      let healthData = null;
      try {
        healthData = JSON.parse(result);
      } catch (e) {
        // JSON 解析失败
      }

      this.results.push({
        name: '健康检查',
        status: 'success',
        duration: Date.now() - startTime,
        details: healthData
      });
    } catch (error) {
      this.results.push({
        name: '健康检查',
        status: error instanceof Error && error.message === '操作超时' ? 'timeout' : 'error',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testConcurrentCalls(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge || typeof bridge.get_courses !== 'function') {
        throw new Error('Bridge 不可用');
      }

      // 并发调用3次 get_courses
      const promises = Array.from({ length: 3 }, (_, i) => 
        bridge.get_courses().then(
          (result: any) => ({ index: i, status: 'success', result }),
          (error: any) => ({ index: i, status: 'error', error: error.message })
        )
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status === 'success').length;

      this.results.push({
        name: '并发调用测试',
        status: successCount > 0 ? 'success' : 'error',
        duration: Date.now() - startTime,
        details: {
          totalCalls: 3,
          successCount,
          results
        }
      });
    } catch (error) {
      this.results.push({
        name: '并发调用测试',
        status: 'error',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private printSummary(): void {
    console.group('📊 Bridge 测试结果汇总');
    
    const summary = {
      total: this.results.length,
      success: this.results.filter(r => r.status === 'success').length,
      error: this.results.filter(r => r.status === 'error').length,
      timeout: this.results.filter(r => r.status === 'timeout').length
    };

    console.log('总体统计:', summary);
    
    this.results.forEach(result => {
      const icon = result.status === 'success' ? '✅' : result.status === 'timeout' ? '⏰' : '❌';
      console.log(`${icon} ${result.name}: ${result.status} (${result.duration}ms)`);
      
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }
      
      if (result.details) {
        console.log('   详情:', result.details);
      }
    });
    
    console.groupEnd();

    // 提供诊断建议
    this.provideDiagnostics(summary);
  }

  private provideDiagnostics(summary: any): void {
    console.group('🔍 诊断建议');
    
    if (summary.success === summary.total) {
      console.log('✅ 所有测试通过！Bridge 连接正常。');
    } else {
      if (this.results.find(r => r.name === 'Bridge 可用性' && r.status === 'error')) {
        console.log('❌ Bridge 不可用 - 检查 QWebChannel 连接');
      }
      
      if (this.results.find(r => r.name === 'QWebChannel 连接' && r.status === 'error')) {
        console.log('❌ QWebChannel 连接问题 - 检查 Qt 环境');
      }
      
      if (summary.timeout > 0) {
        console.log('⏰ 存在超时问题 - 检查 Python 端性能');
      }
      
      if (this.results.find(r => r.name === 'get_courses 调用' && r.status !== 'success')) {
        console.log('❌ get_courses 调用失败 - 这是主要问题');
      }
    }
    
    console.groupEnd();
  }

  getResults(): TestResult[] {
    return [...this.results];
  }
}

// 导出测试套件
export const bridgeTestSuite = new BridgeTestSuite();

// 全局访问
(window as any).bridgeTestSuite = bridgeTestSuite;