export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }],
  },
  // Relative globs also work when a Windows checkout lives in a nested path.
  testMatch: [
    '**/src/**/__tests__/**/*.(ts|tsx)',
    '**/src/**/*.(test|spec).(ts|tsx)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.(ts|tsx)',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // 添加全局超时限制防止无限循环
  testTimeout: 30000, // 30秒全局超时
  // 限制并发测试数量
  maxWorkers: 1,
  // 在第一个失败后停止
  bail: false,
  // 强制退出
  forceExit: true,
  // 检测打开的句柄
  detectOpenHandles: true
};