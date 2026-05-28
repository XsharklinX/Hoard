import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python }     from '@codemirror/lang-python'
import { rust }       from '@codemirror/lang-rust'
import { go }         from '@codemirror/lang-go'
import { java }       from '@codemirror/lang-java'
import { cpp }        from '@codemirror/lang-cpp'
import { html }       from '@codemirror/lang-html'
import { css }        from '@codemirror/lang-css'
import { sql }        from '@codemirror/lang-sql'
import { php }        from '@codemirror/lang-php'
import { json }       from '@codemirror/lang-json'
import { markdown }   from '@codemirror/lang-markdown'
import { yaml }       from '@codemirror/lang-yaml'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import type { Extension } from '@codemirror/state'

const LANG_EXTENSIONS: Record<string, () => Extension> = {
  javascript:  javascript,
  typescript:  () => javascript({ typescript: true }),
  python:      python,
  rust:        rust,
  go:          go,
  java:        java,
  cpp:         cpp,
  c:           cpp,
  html:        html,
  css:         css,
  sql:         () => sql(),
  php:         php,
  json:        json,
  markdown:    markdown,
  yaml:        yaml,
}

interface CodeEditorProps {
  value: string
  onChange?: (val: string) => void
  language?: string | null
  readOnly?: boolean
  className?: string
  minHeight?: string
}

export function CodeEditor({ value, onChange, language, readOnly, className, minHeight = '160px' }: CodeEditorProps) {
  const langKey  = (language ?? 'javascript').toLowerCase()
  const langExt  = LANG_EXTENSIONS[langKey]
  const exts: Extension[] = langExt ? [langExt()] : []

  return (
    <div className={className} style={{ minHeight }}>
      <CodeMirror
        value={value}
        height={minHeight}
        theme={vscodeDark}
        extensions={exts}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          autocompletion: false,
          highlightActiveLine: !readOnly,
        }}
        style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)' }}
      />
    </div>
  )
}
