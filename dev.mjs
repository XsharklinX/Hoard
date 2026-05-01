// Unsets ELECTRON_RUN_AS_NODE so Electron starts as a proper Electron app
// and not as a Node.js subprocess (VS Code sets this env var for its own runner)
import { spawn } from 'child_process'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const proc = spawn('npx', ['electron-vite', 'dev'], {
  env,
  stdio: 'inherit',
  shell: true
})

proc.on('exit', (code) => process.exit(code ?? 0))
