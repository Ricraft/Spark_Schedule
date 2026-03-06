"""
性能优化工具

提供缓存、数据加载优化和性能监控功能
"""

import time
import json
import hashlib
import logging
from typing import Dict, Any, Optional, Callable, List, Tuple
from datetime import datetime, timedelta
from functools import wraps
from dataclasses import dataclass, asdict
from threading import Lock
import weakref


@dataclass
class CacheEntry:
    """缓存条目"""
    data: Any
    timestamp: datetime
    access_count: int = 0
    last_access: datetime = None
    ttl: Optional[int] = None  # 生存时间（秒）
    
    def __post_init__(self):
        if self.last_access is None:
            self.last_access = self.timestamp
    
    def is_expired(self) -> bool:
        """检查是否过期"""
        if self.ttl is None:
            return False
        return datetime.now() - self.timestamp > timedelta(seconds=self.ttl)
    
    def access(self):
        """记录访问"""
        self.access_count += 1
        self.last_access = datetime.now()


@dataclass
class PerformanceMetrics:
    """性能指标"""
    operation_name: str
    start_time: float
    end_time: float
    duration: float
    memory_usage: Optional[int] = None
    cache_hits: int = 0
    cache_misses: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class LRUCache:
    """LRU缓存实现"""
    
    def __init__(self, max_size: int = 100, default_ttl: Optional[int] = None):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cache: Dict[str, CacheEntry] = {}
        self.access_order: List[str] = []
        self.lock = Lock()
        self.hits = 0
        self.misses = 0
    
    def _generate_key(self, *args, **kwargs) -> str:
        """生成缓存键"""
        key_data = str(args) + str(sorted(kwargs.items()))
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        with self.lock:
            if key in self.cache:
                entry = self.cache[key]
                if entry.is_expired():
                    self._remove_key(key)
                    self.misses += 1
                    return None
                
                entry.access()
                # 更新访问顺序
                if key in self.access_order:
                    self.access_order.remove(key)
                self.access_order.append(key)
                
                self.hits += 1
                return entry.data
            
            self.misses += 1
            return None
    
    def put(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """存储缓存值"""
        with self.lock:
            if ttl is None:
                ttl = self.default_ttl
            
            entry = CacheEntry(
                data=value,
                timestamp=datetime.now(),
                ttl=ttl
            )
            
            if key in self.cache:
                # 更新现有条目
                self.cache[key] = entry
                if key in self.access_order:
                    self.access_order.remove(key)
                self.access_order.append(key)
            else:
                # 添加新条目
                if len(self.cache) >= self.max_size:
                    self._evict_lru()
                
                self.cache[key] = entry
                self.access_order.append(key)
    
    def _remove_key(self, key: str) -> None:
        """移除键"""
        if key in self.cache:
            del self.cache[key]
        if key in self.access_order:
            self.access_order.remove(key)
    
    def _evict_lru(self) -> None:
        """驱逐最少使用的条目"""
        if self.access_order:
            lru_key = self.access_order[0]
            self._remove_key(lru_key)
    
    def clear(self) -> None:
        """清空缓存"""
        with self.lock:
            self.cache.clear()
            self.access_order.clear()
            self.hits = 0
            self.misses = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        total_requests = self.hits + self.misses
        hit_rate = self.hits / total_requests if total_requests > 0 else 0
        
        return {
            'size': len(self.cache),
            'max_size': self.max_size,
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate': hit_rate,
            'total_requests': total_requests
        }


class PerformanceOptimizer:
    """性能优化器"""
    
    def __init__(self):
        self.logger = logging.getLogger('PerformanceOptimizer')
        self.caches: Dict[str, LRUCache] = {}
        self.metrics: List[PerformanceMetrics] = []
        self.function_cache = LRUCache(max_size=200, default_ttl=300)  # 5分钟TTL
        
        # 创建默认缓存
        self.create_cache('courses', max_size=50, ttl=600)  # 10分钟
        self.create_cache('settings', max_size=10, ttl=1800)  # 30分钟
        self.create_cache('groups', max_size=30, ttl=900)  # 15分钟
    
    def create_cache(self, name: str, max_size: int = 100, ttl: Optional[int] = None) -> LRUCache:
        """创建命名缓存"""
        cache = LRUCache(max_size=max_size, default_ttl=ttl)
        self.caches[name] = cache
        return cache
    
    def get_cache(self, name: str) -> Optional[LRUCache]:
        """获取命名缓存"""
        return self.caches.get(name)
    
    def cached_function(self, cache_name: str = 'default', ttl: Optional[int] = None):
        """函数缓存装饰器"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # 生成缓存键
                cache_key = f"{func.__name__}_{self.function_cache._generate_key(*args, **kwargs)}"
                
                # 尝试从缓存获取
                cached_result = self.function_cache.get(cache_key)
                if cached_result is not None:
                    return cached_result
                
                # 执行函数并缓存结果
                result = func(*args, **kwargs)
                self.function_cache.put(cache_key, result, ttl)
                
                return result
            
            return wrapper
        return decorator
    
    def performance_monitor(self, operation_name: str):
        """性能监控装饰器"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                
                try:
                    result = func(*args, **kwargs)
                    return result
                finally:
                    end_time = time.time()
                    duration = end_time - start_time
                    
                    # 记录性能指标
                    metrics = PerformanceMetrics(
                        operation_name=operation_name,
                        start_time=start_time,
                        end_time=end_time,
                        duration=duration
                    )
                    
                    self.metrics.append(metrics)
                    
                    # 保留最近1000条记录
                    if len(self.metrics) > 1000:
                        self.metrics = self.metrics[-1000:]
                    
                    # 记录慢操作
                    if duration > 1.0:  # 超过1秒
                        self.logger.warning(f"慢操作检测: {operation_name} 耗时 {duration:.2f}s")
            
            return wrapper
        return decorator
    
    def optimize_json_loading(self, file_path: str, cache_name: str = 'json_files') -> Optional[Dict[str, Any]]:
        """优化JSON文件加载"""
        cache = self.get_cache(cache_name)
        if not cache:
            cache = self.create_cache(cache_name, max_size=20, ttl=300)
        
        # 尝试从缓存获取
        cached_data = cache.get(file_path)
        if cached_data is not None:
            return cached_data
        
        # 从文件加载
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 缓存数据
            cache.put(file_path, data)
            return data
            
        except Exception as e:
            self.logger.error(f"加载JSON文件失败: {file_path} - {e}")
            return None
    
    def batch_process(self, items: List[Any], processor: Callable, batch_size: int = 50) -> List[Any]:
        """批量处理优化"""
        results = []
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            batch_results = []
            
            for item in batch:
                try:
                    result = processor(item)
                    batch_results.append(result)
                except Exception as e:
                    self.logger.error(f"批量处理项目失败: {e}")
                    batch_results.append(None)
            
            results.extend(batch_results)
        
        return results
    
    def debounce(self, wait_time: float):
        """防抖装饰器"""
        def decorator(func: Callable) -> Callable:
            last_called = [0.0]
            
            @wraps(func)
            def wrapper(*args, **kwargs):
                current_time = time.time()
                
                if current_time - last_called[0] >= wait_time:
                    last_called[0] = current_time
                    return func(*args, **kwargs)
                
                return None
            
            return wrapper
        return decorator
    
    def throttle(self, rate_limit: float):
        """节流装饰器"""
        def decorator(func: Callable) -> Callable:
            last_called = [0.0]
            
            @wraps(func)
            def wrapper(*args, **kwargs):
                current_time = time.time()
                
                if current_time - last_called[0] >= 1.0 / rate_limit:
                    last_called[0] = current_time
                    return func(*args, **kwargs)
                
                return None
            
            return wrapper
        return decorator
    
    def get_performance_report(self) -> Dict[str, Any]:
        """获取性能报告"""
        if not self.metrics:
            return {"message": "暂无性能数据"}
        
        # 计算统计信息
        durations = [m.duration for m in self.metrics]
        operations = {}
        
        for metric in self.metrics:
            op_name = metric.operation_name
            if op_name not in operations:
                operations[op_name] = []
            operations[op_name].append(metric.duration)
        
        # 生成报告
        report = {
            'total_operations': len(self.metrics),
            'average_duration': sum(durations) / len(durations),
            'max_duration': max(durations),
            'min_duration': min(durations),
            'slow_operations': len([d for d in durations if d > 1.0]),
            'operations_summary': {}
        }
        
        for op_name, op_durations in operations.items():
            report['operations_summary'][op_name] = {
                'count': len(op_durations),
                'average': sum(op_durations) / len(op_durations),
                'max': max(op_durations),
                'min': min(op_durations)
            }
        
        # 添加缓存统计
        report['cache_stats'] = {}
        for cache_name, cache in self.caches.items():
            report['cache_stats'][cache_name] = cache.get_stats()
        
        return report
    
    def clear_all_caches(self) -> None:
        """清空所有缓存"""
        for cache in self.caches.values():
            cache.clear()
        self.function_cache.clear()
        self.logger.info("所有缓存已清空")
    
    def optimize_memory_usage(self) -> Dict[str, Any]:
        """优化内存使用"""
        # 清理过期缓存条目
        cleaned_count = 0
        
        for cache_name, cache in self.caches.items():
            with cache.lock:
                expired_keys = []
                for key, entry in cache.cache.items():
                    if entry.is_expired():
                        expired_keys.append(key)
                
                for key in expired_keys:
                    cache._remove_key(key)
                    cleaned_count += 1
        
        # 清理旧的性能指标
        if len(self.metrics) > 500:
            self.metrics = self.metrics[-500:]
        
        return {
            'cleaned_cache_entries': cleaned_count,
            'remaining_metrics': len(self.metrics),
            'active_caches': len(self.caches)
        }


# 全局性能优化器实例
performance_optimizer = PerformanceOptimizer()


# 便捷装饰器
def cached(cache_name: str = 'default', ttl: Optional[int] = None):
    """缓存装饰器"""
    return performance_optimizer.cached_function(cache_name, ttl)


def monitor_performance(operation_name: str):
    """性能监控装饰器"""
    return performance_optimizer.performance_monitor(operation_name)


def debounce(wait_time: float):
    """防抖装饰器"""
    return performance_optimizer.debounce(wait_time)


def throttle(rate_limit: float):
    """节流装饰器"""
    return performance_optimizer.throttle(rate_limit)