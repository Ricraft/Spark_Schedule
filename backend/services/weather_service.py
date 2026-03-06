import requests
from typing import Optional, Dict, Any
import os
import json
import time


class WeatherService:
    """和风天气服务"""
    
    def __init__(self, api_key: str, api_host: str = "devapi.qweather.com", cache_file: str = "data/weather_cache.json"):
        """
        初始化天气服务
        
        Args:
            api_key: 和风天气API密钥
            api_host: API Host域名（从和风天气控制台获取）
            cache_file: 天气缓存文件路径
        """
        self.api_key = api_key
        self.api_host = api_host
        self.cache_file = cache_file
        # 使用自定义 API Host，注意路径前缀
        self.geo_api_url = f"https://{api_host}/geo/v2/city/lookup"
        self.weather_api_url = f"https://{api_host}/v7/weather/now"
    
    def _load_cache(self, city: str) -> Optional[Dict[str, Any]]:
        """
        从文件加载天气缓存
        
        Returns:
            天气数据字典，如果不存在或已过期则返回None
        """
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    full_cache = json.load(f)
                
                cache_data = full_cache.get(city)
                if not cache_data:
                    return None
                
                # 检查缓存是否在30分钟内 (1800秒)
                cache_time = cache_data.get('timestamp', 0)
                current_time = time.time()
                
                if current_time - cache_time < 1800:
                    print(f"🚀 [WeatherService] 使用30分钟内的天气缓存 ({city}) (剩余 {int(1800 - (current_time - cache_time))}s)")
                    return cache_data.get('data')
                else:
                    print(f"🕒 [WeatherService] 天气缓存已过期 ({city}) ({(current_time - cache_time) / 60:.1f} min)")
        except Exception as e:
            print(f"⚠️ [WeatherService] 加载天气缓存失败: {e}")
        return None

    def _save_cache(self, city: str, data: Dict[str, Any]):
        """
        保存天气数据到缓存文件
        
        Args:
            city: 城市名称
            data: 天气内容字典
        """
        try:
            os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
            
            # 读取现有完整缓存
            full_cache = {}
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    full_cache = json.load(f)
            
            # 更新特定城市缓存
            full_cache[city] = {
                'timestamp': time.time(),
                'data': data
            }
            
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(full_cache, f, ensure_ascii=False, indent=2)
            print(f"💾 [WeatherService] 天气内容已缓存 ({city})")
        except Exception as e:
            print(f"⚠️ [WeatherService] 保存天气缓存失败: {e}")

    def get_weather_emoji(self, text: str) -> Dict[str, str]:
        """
        根据天气文本获取对应的emoji和颜色
        
        Args:
            text: 天气描述文本
            
        Returns:
            包含icon和color的字典
        """
        if '晴' in text:
            return {'icon': '☀️', 'color': 'text-amber-500'}
        elif '云' in text or '阴' in text:
            return {'icon': '⛅', 'color': 'text-slate-500'}
        elif '雨' in text:
            return {'icon': '🌧️', 'color': 'text-blue-500'}
        elif '雪' in text:
            return {'icon': '❄️', 'color': 'text-sky-400'}
        elif '雷' in text:
            return {'icon': '⛈️', 'color': 'text-indigo-500'}
        elif '雾' in text or '霾' in text:
            return {'icon': '🌫️', 'color': 'text-slate-400'}
        else:
            return {'icon': '🌡️', 'color': 'text-slate-500'}
    
    def get_location_id(self, city: str) -> Optional[Dict[str, str]]:
        """
        获取城市的location ID
        
        Args:
            city: 城市名称
            
        Returns:
            包含location_id和city_name的字典，失败返回None
        """
        try:
            # 🔒 安全：不在日志中暴露完整 URL 和 API Key
            print(f"🔍 [WeatherService] 请求城市查询: {city}")
            
            response = requests.get(
                self.geo_api_url,
                params={'location': city, 'key': self.api_key},
                timeout=10
            )
            
            print(f"📡 [WeatherService] 响应状态码: {response.status_code}")
            # 🔒 安全：不在日志中暴露完整响应内容（可能包含敏感信息）
            if response.status_code != 200:
                print(f"❌ [WeatherService] 城市查询请求失败: HTTP {response.status_code}")
                return None
            
            data = response.json()
            
            if data.get('code') != '200' or not data.get('location'):
                print(f"❌ [WeatherService] 城市查询失败: {data.get('code')}")
                return None
            
            location = data['location'][0]
            return {
                'location_id': location['id'],
                'city_name': location['name']
            }
            
        except requests.RequestException as e:
            print(f"❌ [WeatherService] 城市查询网络错误: {e}")
            return None
        except Exception as e:
            print(f"❌ [WeatherService] 城市查询异常: {e}")
            return None
    
    def get_weather(self, city: str = '北京') -> Optional[Dict[str, Any]]:
        """
        获取指定城市的实时天气 (优先使用缓存)
        
        Args:
            city: 城市名称，默认北京
            
        Returns:
            天气信息字典，包含temp, text, icon, color, city字段
            失败返回None
        """
        # 1. 尝试从缓存获取
        cached_weather = self._load_cache(city)
        if cached_weather:
            return cached_weather

        try:
            # 2. 获取城市ID
            location_info = self.get_location_id(city)
            if not location_info:
                return None
            
            location_id = location_info['location_id']
            city_name = location_info['city_name']
            
            # 3. 获取实时天气
            response = requests.get(
                self.weather_api_url,
                params={'location': location_id, 'key': self.api_key},
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"❌ [WeatherService] 天气请求失败: {response.status_code}")
                return None
            
            data = response.json()
            
            if data.get('code') != '200' or not data.get('now'):
                print(f"❌ [WeatherService] 天气获取失败: {data.get('code')}")
                return None
            
            now = data['now']
            ui_style = self.get_weather_emoji(now['text'])
            
            weather_info = {
                'temp': int(now['temp']),
                'text': now['text'],
                'city': city_name,
                **ui_style
            }
            
            # 4. 保存到缓存
            self._save_cache(city, weather_info)
            
            print(f"✅ [WeatherService] 天气获取成功: {city_name} {now['temp']}°C {now['text']}")
            return weather_info
            
        except requests.RequestException as e:
            print(f"❌ [WeatherService] 天气获取网络错误: {e}")
            return None
        except Exception as e:
            print(f"❌ [WeatherService] 天气获取异常: {e}")
            return None
