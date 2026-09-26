// src/useBackend.ts
import { useEffect, useState } from 'react';
// 引入 qwebchannel.js 作为脚本，不使用 ES6 导入
import './qwebchannel.js'; 

export function useBackend() {
  const [backend, setBackend] = useState<any>(null);

  useEffect(() => {
    // 只有在 Qt 环境下才会有 qt.webChannelTransport
    if (window.qt && window.qt.webChannelTransport && window.QWebChannel) {
      new window.QWebChannel(window.qt.webChannelTransport, (channel: any) => {
        // 统一使用 'bridge' 名称
        const py = channel.objects.bridge;
        setBackend(py);
        console.log("已连接到 Python 后端");
      });
    } else {
      console.log("未检测到 Python 环境，使用模拟数据");
    }
  }, []);

  // 封装一个获取课表的函数
  const getSchedule = async () => {
    if (backend) {
      // 调用 Python 的 get_schedule_data 函数
      // 注意：Python 返回数据通常需要通过回调或 Promise，这里简化演示
      backend.get_schedule_data((response: string) => {
        const data = JSON.parse(response);
        console.log("收到课表:", data);
        return data;
      });
    }
  };

  return { backend, getSchedule };
}