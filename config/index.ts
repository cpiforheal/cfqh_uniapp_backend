import path from 'node:path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'

export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'cfqh_procedure',
    date: '2026-05-05',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false,
      },
    },
    cache: {
      enable: false,
    },
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
    defineConstants: {
      'process.env.TARO_APP_API_BASE': JSON.stringify(process.env.TARO_APP_API_BASE || ''),
      'process.env.TARO_APP_API_FALLBACK_BASES': JSON.stringify(process.env.TARO_APP_API_FALLBACK_BASES || ''),
      'process.env.TARO_APP_USE_CLOUD_GATEWAY': JSON.stringify(process.env.TARO_APP_USE_CLOUD_GATEWAY || ''),
      'process.env.TARO_APP_CLOUD_ENV_ID': JSON.stringify(process.env.TARO_APP_CLOUD_ENV_ID || ''),
      'process.env.TARO_APP_CLOUD_GATEWAY_NAME': JSON.stringify(process.env.TARO_APP_CLOUD_GATEWAY_NAME || ''),
      'process.env.TARO_APP_USE_MOCK_FALLBACK': JSON.stringify(process.env.TARO_APP_USE_MOCK_FALLBACK || ''),
      'process.env.TARO_APP_DEBUG_API': JSON.stringify(process.env.TARO_APP_DEBUG_API || ''),
      'process.env.TARO_APP_DEV_OPEN_ID': JSON.stringify(process.env.TARO_APP_DEV_OPEN_ID || ''),
      'process.env.TARO_APP_DEV_TOKEN_CODE': JSON.stringify(process.env.TARO_APP_DEV_TOKEN_CODE || ''),
      'process.env.TARO_APP_SKIP_WECHAT_LOGIN': JSON.stringify(process.env.TARO_APP_SKIP_WECHAT_LOGIN || ''),
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    h5: {},
  }

  if (process.env.NODE_ENV === 'production') {
    return merge({}, baseConfig, {
      mini: {},
      h5: {},
    })
  }

  return merge({}, baseConfig, {
    mini: {},
    h5: {},
  })
})
