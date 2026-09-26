import React, { useState, useEffect, useRef } from 'react';
import { usePython } from '../hooks/usePython';
import './ImportSchedulerModal.css';

interface ImportSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportSchedulerModal: React.FC<ImportSchedulerModalProps> = ({ isOpen, onClose }) => {
  const { bridge, isReady } = usePython();
  const [url, setUrl] = useState('https://jwc.example.edu.cn'); 
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showUrlSuggestions, setShowUrlSuggestions] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [extractSuccess, setExtractSuccess] = useState<boolean | null>(null);
  
  const modalRef = useRef<HTMLDivElement>(null);

  // 🔥 监听导入进度信号 (增强版：移除 onClose 依赖以保持连接稳定)
  useEffect(() => {
    if (!bridge || !isReady) {
      console.log('⏳ [ImportModal] 等待 Bridge 就绪以建立信号...');
      return;
    }

    const onProgress = (msg: string) => {
      console.log('📡 [Signal] 收到后端进度:', msg);
      setStatusMessage(msg);
      
      const isSuccess = msg.includes('成功') || msg.includes('共导入');
      const isError = msg.includes('❌') || msg.includes('失败') || msg.includes('异常');

      if (isSuccess) {
        console.log('✨ [Modal] 导入成功，UI已通过信号更新');
        setIsExtracting(false);
        setExtractSuccess(true);

        // ✅ 兜底：即使 scheduleLoaded 信号偶发没接住，也强制通知主页面 refresh 一次
        console.log('🚨 [Modal] about to dispatch refresh_request');
        window.dispatchEvent(new CustomEvent('scheduleDataUpdated', {
          detail: { action: 'refresh_request' }
        }));
        console.log('🚨 [Modal] dispatched refresh_request');
        
        // 3秒后通知父组件关闭
        setTimeout(() => {
          if (modalRef.current) onClose();
        }, 3000); 
      } else if (isError) {
        setIsExtracting(false);
        setExtractSuccess(false);
      }
    };

    console.log('🔌 [ImportModal] 正在尝试建立 importProgress 信号连接...');
    try {
      if (bridge.importProgress && typeof bridge.importProgress.connect === 'function') {
        bridge.importProgress.connect(onProgress);
        console.log('✅ [ImportModal] 信号通道已建立');
      } else {
        console.warn('⚠️ [ImportModal] bridge.importProgress 不可用');
      }
    } catch (error) {
      console.error('❌ [ImportModal] 信号建立失败:', error);
    }

    return () => {
      try {
        if (bridge.importProgress) {
          bridge.importProgress.disconnect(onProgress);
          console.log('🔌 [ImportModal] 信号通道已断开');
        }
      } catch(e) {}
    };
  }, [bridge, isReady]); 


  useEffect(() => {
    // 弹窗打开时，通知 Python 准备 WebEngineView
    if (isOpen && isReady && bridge) {
      // 告诉 Python 弹窗的尺寸和位置，让 QWebEngineView 覆盖其内部区域
      const rect = modalRef.current?.getBoundingClientRect();
      if (rect && typeof bridge.open_web_browser_view === 'function') {
        // 计算浏览器内容区域的位置（确保不挡住底部按钮）
        const headerHeight = 50; // 标题栏高度
        const controlsHeight = 50; // 控制栏高度
        const footerHeight = 80; // 底部高度（增加以确保按钮可见）
        const scrollbarSpace = 15; // 滚动条空间
        
        const browserConfig = {
          visible: true,
          x: Math.round(rect.left + 10), // 左边留10px边距
          y: Math.round(rect.top + headerHeight + controlsHeight), // 向下移动
          width: Math.round(rect.width - scrollbarSpace), // 减去滚动条宽度
          height: Math.round(rect.height - headerHeight - controlsHeight - footerHeight), // 浏览器高度
          url: url
        };
        
        console.log('🔥 [Frontend] 发送浏览器配置:', browserConfig);
        bridge.open_web_browser_view(JSON.stringify(browserConfig));
      }
    } else if (!isOpen && isReady && bridge && typeof bridge.hide_web_browser_view === 'function') {
      // 弹窗关闭时，通知 Python 隐藏 WebEngineView
      bridge.hide_web_browser_view();
    }

    // 监听窗口大小变化，通知 Python 调整浏览器视图大小
    const handleResize = () => {
      if (isOpen && modalRef.current && isReady && bridge && typeof bridge.resize_web_browser_view === 'function') {
        const rect = modalRef.current.getBoundingClientRect();
        const headerHeight = 50;
        const controlsHeight = 50;
        const footerHeight = 80; // 增加底部预留空间
        const scrollbarSpace = 15;
        
        const resizeConfig = {
          x: Math.round(rect.left + 10),
          y: Math.round(rect.top + headerHeight + controlsHeight),
          width: Math.round(rect.width - scrollbarSpace),
          height: Math.round(rect.height - headerHeight - controlsHeight - footerHeight)
        };
        
        bridge.resize_web_browser_view(JSON.stringify(resizeConfig));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, isReady, bridge, url]);

  const handleGo = async () => {
    if (!bridge || !isReady || typeof bridge.load_url_in_browser !== 'function') return;
    
    setIsLoadingPage(true);
    try {
      await bridge.load_url_in_browser(url);
    } catch (error) {
      console.error("加载 URL 失败:", error);
    } finally {
      setIsLoadingPage(false);
    }
  };

  const handleExtractSchedule = async () => {
    if (!bridge || !isReady || typeof bridge.extract_schedule_from_browser !== 'function') return;
    
    setIsExtracting(true);
    setStatusMessage('🚀 准备提取课表...');
    setExtractSuccess(null);
    
    try {
      const resultStr = await bridge.extract_schedule_from_browser();
      const result = JSON.parse(resultStr);
      if (result.status === 'processing') {
        setStatusMessage('⏳ 正在解析页面内容...');
        
        // 🚨 兜底逻辑：如果 12 秒后还没收到信号，主动检查
        setTimeout(async () => {
          if (isExtracting) {
            console.log('⏰ [兜底] 检查数据更新...');
            const py = (window as any).pyBridge;
            if (py && typeof py.get_courses === 'function') {
              const data = await py.get_courses();
              if (data && data !== '[]' && data.length > 10) {
                setStatusMessage('✨ 数据已同步 (信号补偿)');
                setExtractSuccess(true);
                setIsExtracting(false);
                // 🔥 不再发送空事件，数据已通过 scheduleLoaded 信号传递
                setTimeout(() => onClose(), 2000);
              }
            }
          }
        }, 12000);
      } else if (result.status === 'error') {
        setStatusMessage(`❌ 错误: ${result.message}`);
        setIsExtracting(false);
      }
    } catch (error) {
      setStatusMessage('🚨 提取异常，请重试');
      setIsExtracting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="import-modal-overlay">
      <div ref={modalRef} className="import-modal-window win11-mica">
        {/* 顶部标题栏 */}
        <div className="import-modal-header">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-indigo-600 rounded-full" />
            <h2 className="text-xl font-black text-slate-800">教务系统导入</h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* 地址栏与操作按钮 */}
        <div className="import-modal-controls">
          <div className="relative w-full">
            <input
              type="text"
              className="w-full win11-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setShowUrlSuggestions(true)}
              onBlur={() => setTimeout(() => setShowUrlSuggestions(false), 200)}
              placeholder="输入教务系统网址"
            />
          </div>
          <button className="win11-button primary px-6" onClick={handleExtractSchedule} disabled={isExtracting}>
            {isExtracting ? '提取中...' : '提取课表'}
          </button>
        </div>

        {/* 核心：进度与浏览器显示区域 */}
        <div className="import-modal-browser-view-placeholder" style={{ 
          minHeight: '500px', 
          position: 'relative',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          margin: '12px',
          overflow: 'hidden'
        }}>
          {/* 实时状态蒙层：当提取时或完成后覆盖在上面 */}
          {(isExtracting || statusMessage) && (
            <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center transition-all duration-500 ${
              extractSuccess === true ? 'bg-green-50/95' : 
              extractSuccess === false ? 'bg-red-50/95' : 'bg-white/80 backdrop-blur-md'
            }`}>
              {isExtracting && (
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6" />
              )}
              {extractSuccess === true && (
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200 animate-bounce">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              {extractSuccess === false && (
                <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-200">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
              )}
              
              <h3 className={`text-lg font-black mb-2 ${
                extractSuccess === true ? 'text-green-700' : 
                extractSuccess === false ? 'text-red-700' : 'text-slate-800'
              }`}>
                {extractSuccess === true ? '恭喜！提取成功' : 
                 extractSuccess === false ? '抱歉，提取失败' : '正在处理中'}
              </h3>
              
              <p className={`max-w-xs font-bold text-sm leading-relaxed ${
                extractSuccess === true ? 'text-green-600' : 
                extractSuccess === false ? 'text-red-600' : 'text-slate-500'
              }`}>
                {statusMessage}
              </p>

              {extractSuccess === true && (
                <p className="mt-8 text-[10px] text-green-500 font-bold uppercase tracking-widest animate-pulse">
                  即将为您跳转回课表...
                </p>
              )}
            </div>
          )}

          {/* 默认提示（无状态时显示） */}
          {!isExtracting && !statusMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <p className="font-bold">内嵌浏览器将在此区域显示</p>
              <p className="text-xs mt-2">请先加载教务系统页面，登录后点击右上角“提取课表”</p>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="import-modal-footer flex justify-between items-center px-6 py-4 bg-slate-50/50 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
            支持：强智、正方、个人本地 HTML 提取
          </div>
          <button className="win11-button" onClick={onClose}>取消并返回</button>
        </div>
      </div>
    </div>
  );
};

export default ImportSchedulerModal;