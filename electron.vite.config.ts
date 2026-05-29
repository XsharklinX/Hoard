import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/main/index.ts'),
        formats: ['cjs']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/preload/index.ts')
      },
      rollupOptions: {
        external: [/^node:/, 'url', 'fs', 'path', 'http', 'https', 'events', 'stream', 'electron']
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: resolve('index.html'),
        output: {
          manualChunks: {
            'react-vendor':  ['react', 'react-dom'],
            'editor':        ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/extension-link', '@tiptap/extension-task-list', '@tiptap/extension-task-item'],
            'syntax':        ['react-syntax-highlighter'],
            'radix':         ['@radix-ui/react-context-menu', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip'],
          }
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src')
      }
    },
    plugins: [react()]
  }
})
