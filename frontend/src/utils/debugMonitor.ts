/**
 * 调试监控工具 - 用于跟踪导航和状态问题
 */

interface NavigationEvent {
  timestamp: number;
  from: string;
  to: string;
  action: string;
}

interface BridgeState {
  timestamp: number;
  method: string;
  status: 'start' | 'success' | 'error';
  details?: any;
}

class DebugMonitor {
  private static instance: DebugMonitor;
  private navigationHistory: NavigationEvent[] = [];
  private bridgeHistory: BridgeState[] = [];
  private maxHistorySize = 50;

  static getInstance(): DebugMonitor {
    if (!DebugMonitor.instance) {
      DebugMonitor.instance = new DebugMonitor();
    }
    return DebugMonitor.instance;
  }

  logNavigation(from: string, to: string, action: string = 'navigate') {
    const event: NavigationEvent = {
      timestamp: Date.now(),
      from,
      to,
      action
    };
    
    this.navigationHistory.push(event);
    if (this.navigationHistory.length > this.maxHistorySize) {
      this.navigationHistory.shift();
    }
    
    console.log(`🧭 [Monitor] 导航: ${from} → ${to} (${action})`);
    
    // 检测问题模式
    this.detectNavigationPatterns();
  }

  logBridgeCall(method: string, status: 'start' | 'success' | 'error', details?: any) {
    const event: BridgeState = {
      timestamp: Date.now(),
      method,
      status,
      details
    };
    
    this.bridgeHistory.push(event);
    if (this.bridgeHistory.length > this.maxHistorySize) {
      this.bridgeHistory.shift();
    }
    
    const statusIcon = status === 'start' ? '🔄' : status === 'success' ? '✅' : '❌';
    console.log(`${statusIcon} [Monitor] Bridge ${method}: ${status}`, details || '');
  }

  private detectNavigationPatterns() {
    const recent = this.navigationHistory.slice(-5); // 最近5次导航
    
    // 检测仪表盘 → 主课表 → 仪表盘 → 主课表 模式
    if (recent.length >= 4) {
      const pattern = recent.slice(-4).map(e => e.to).join(' → ');
      if (pattern === '/ → /schedule → / → /schedule') {
        console.warn('⚠️ [Monitor] 检测到问题导航模式: 仪表盘 ↔ 主课表 循环');
        this.reportIssue('navigation_loop', { pattern, recent });
      }
    }
    
    // 检测频繁切换
    const last10Seconds = recent.filter(e => Date.now() - e.timestamp < 10000);
    if (last10Seconds.length > 6) {
      console.warn('⚠️ [Monitor] 检测到频繁导航切换');
      this.reportIssue('frequent_navigation', { count: last10Seconds.length });
    }
  }

  private reportIssue(type: string, details: any) {
    const report = {
      type,
      timestamp: Date.now(),
      details,
      navigationHistory: this.navigationHistory.slice(-10),
      bridgeHistory: this.bridgeHistory.slice(-10)
    };
    
    console.group(`🚨 [Monitor] 问题报告: ${type}`);
    console.log('详情:', details);
    console.log('最近导航:', this.navigationHistory.slice(-5));
    console.log('最近Bridge调用:', this.bridgeHistory.slice(-5));
    console.groupEnd();
    
    // 保存到 sessionStorage 供调试使用
    const reports = JSON.parse(sessionStorage.getItem('debugReports') || '[]');
    reports.push(report);
    if (reports.length > 10) reports.shift();
    sessionStorage.setItem('debugReports', JSON.stringify(reports));
  }

  getNavigationHistory(): NavigationEvent[] {
    return [...this.navigationHistory];
  }

  getBridgeHistory(): BridgeState[] {
    return [...this.bridgeHistory];
  }

  getReports(): any[] {
    return JSON.parse(sessionStorage.getItem('debugReports') || '[]');
  }

  clear() {
    this.navigationHistory = [];
    this.bridgeHistory = [];
    sessionStorage.removeItem('debugReports');
    console.log('🧹 [Monitor] 调试历史已清理');
  }

  // 导出调试信息
  exportDebugInfo() {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      navigationHistory: this.navigationHistory,
      bridgeHistory: this.bridgeHistory,
      reports: this.getReports(),
      sessionStorage: {
        currentPath: sessionStorage.getItem('currentPath'),
        lastNavigation: sessionStorage.getItem('lastNavigation'),
        lastInitTime: sessionStorage.getItem('lastInitTime')
      },
      localStorage: {
        wakeup_courses: localStorage.getItem('wakeup_courses')?.length || 0,
        wakeup_courses_cache: localStorage.getItem('wakeup_courses_cache')?.length || 0
      }
    };
    
    console.log('📊 [Monitor] 调试信息导出:', debugInfo);
    return debugInfo;
  }
}

export const debugMonitor = DebugMonitor.getInstance();

// 全局调试函数
(window as any).debugMonitor = debugMonitor;