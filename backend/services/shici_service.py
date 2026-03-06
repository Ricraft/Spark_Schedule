"""
今日诗词服务

负责获取每日诗词
"""

import requests
from typing import Optional, Dict, Any
import os
import json
import time
from datetime import datetime


class ShiciService:
    """今日诗词服务"""
    
    def __init__(self, token_file: str = "data/jinrishici_token.txt", cache_file: str = "data/shici_cache.json"):
        """
        初始化诗词服务
        
        Args:
            token_file: token缓存文件路径
            cache_file: 诗词内容缓存文件路径
        """
        self.token_file = token_file
        self.cache_file = cache_file
        self.token_api_url = "https://v2.jinrishici.com/token"
        self.sentence_api_url = "https://v2.jinrishici.com/sentence"
        self.token = self._load_token()
    
    def _load_token(self) -> Optional[str]:
        """
        从文件加载token
        
        Returns:
            token字符串，不存在返回None
        """
        try:
            if os.path.exists(self.token_file):
                with open(self.token_file, 'r', encoding='utf-8') as f:
                    token = f.read().strip()
                    if token:
                        print(f"✅ [ShiciService] 从缓存加载token")
                        return token
        except Exception as e:
            print(f"⚠️ [ShiciService] 加载token失败: {e}")
        return None
    
    def _save_token(self, token: str):
        """
        保存token到文件
        
        Args:
            token: token字符串
        """
        try:
            os.makedirs(os.path.dirname(self.token_file), exist_ok=True)
            with open(self.token_file, 'w', encoding='utf-8') as f:
                f.write(token)
            print(f"✅ [ShiciService] Token已保存")
        except Exception as e:
            print(f"⚠️ [ShiciService] 保存token失败: {e}")

    def _load_cache(self) -> Optional[Dict[str, Any]]:
        """
        从文件加载诗词缓存
        
        Returns:
            诗词数据字典，如果不存在或已过期则返回None
        """
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                
                # 检查缓存是否在30分钟内 (1800秒)
                cache_time = cache_data.get('timestamp', 0)
                current_time = time.time()
                
                if current_time - cache_time < 1800:
                    print(f"🚀 [ShiciService] 使用30分钟内的诗词缓存 (剩余 {int(1800 - (current_time - cache_time))}s)")
                    return cache_data.get('data')
                else:
                    print(f"🕒 [ShiciService] 诗词缓存已过期 ({(current_time - cache_time) / 60:.1f} min)")
        except Exception as e:
            print(f"⚠️ [ShiciService] 加载诗词缓存失败: {e}")
        return None

    def _save_cache(self, data: Dict[str, Any]):
        """
        保存诗词数据到缓存文件
        
        Args:
            data: 诗词内容字典
        """
        try:
            os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
            cache_data = {
                'timestamp': time.time(),
                'data': data
            }
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            print(f"💾 [ShiciService] 诗词内容已缓存")
        except Exception as e:
            print(f"⚠️ [ShiciService] 保存诗词缓存失败: {e}")
    
    def _get_new_token(self) -> Optional[str]:
        """
        获取新的token
        
        Returns:
            token字符串，失败返回None
        """
        try:
            response = requests.get(self.token_api_url, timeout=10)
            
            if response.status_code != 200:
                print(f"❌ [ShiciService] Token请求失败: {response.status_code}")
                return None
            
            data = response.json()
            
            if data.get('status') == 'success' and data.get('data'):
                token = data['data']
                self._save_token(token)
                print(f"✅ [ShiciService] 获取新token成功")
                return token
            else:
                print(f"❌ [ShiciService] Token响应异常: {data}")
                return None
                
        except requests.RequestException as e:
            print(f"❌ [ShiciService] Token请求网络错误: {e}")
            return None
        except Exception as e:
            print(f"❌ [ShiciService] Token请求异常: {e}")
            return None
    
    def get_shici(self) -> Optional[Dict[str, Any]]:
        """
        获取今日诗词 (优先使用缓存)
        
        Returns:
            诗词信息字典，包含content, title, author, dynasty字段
            失败返回None
        """
        # 1. 尝试从缓存获取
        cached_shici = self._load_cache()
        if cached_shici:
            return cached_shici

        try:
            # 2. 确保有token
            if not self.token:
                self.token = self._get_new_token()
                if not self.token:
                    return None
            
            # 3. 获取诗词
            response = requests.get(
                self.sentence_api_url,
                headers={'X-User-Token': self.token},
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"❌ [ShiciService] 诗词请求失败: {response.status_code}")
                # token可能过期，尝试获取新token
                self.token = self._get_new_token()
                return None
            
            data = response.json()
            
            if data.get('status') == 'success' and data.get('data'):
                poem_data = data['data']
                origin = poem_data.get('origin', {})
                
                shici_info = {
                    'content': poem_data.get('content', ''),
                    'title': origin.get('title', ''),
                    'author': origin.get('author', ''),
                    'dynasty': origin.get('dynasty', '')
                }
                
                # 4. 保存到缓存
                self._save_cache(shici_info)
                
                print(f"✅ [ShiciService] 诗词获取成功: {shici_info['content'][:20]}...")
                return shici_info
            else:
                print(f"❌ [ShiciService] 诗词响应异常: {data}")
                return None
                
        except requests.RequestException as e:
            print(f"❌ [ShiciService] 诗词请求网络错误: {e}")
            return None
        except Exception as e:
            print(f"❌ [ShiciService] 诗词请求异常: {e}")
            return None
