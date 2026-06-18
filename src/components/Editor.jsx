import Editor from '@monaco-editor/react'
import { GLIDE_DTS } from '../data/glide-types.js'

export default function CodeEditor({ value, onChange, onRun }) {
  function handleBeforeMount(monaco) {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true, // it's GlideScript, not strict TS
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.javascriptDefaults.addExtraLib(GLIDE_DTS, 'glide.d.ts')

    monaco.editor.defineTheme('glide-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'keyword', foreground: '38bdf8' },
        { token: 'type.identifier', foreground: 'c4b5fd' },
      ],
      colors: {
        'editor.background': '#0f1720',
        'editor.foreground': '#dbe4ee',
        'editor.lineHighlightBackground': '#162231',
        'editorLineNumber.foreground': '#526176',
        'editorLineNumber.activeForeground': '#b6c2d2',
        'editorGutter.background': '#0f1720',
        'editor.selectionBackground': '#1d4a3a',
        'editorCursor.foreground': '#35c771',
      },
    })
  }

  function handleMount(editor, monaco) {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRun())
    editor.focus()
  }

  return (
    <Editor
      height="100%"
      defaultLanguage="javascript"
      theme="glide-dark"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      loading={<div className="p-4 font-mono text-sm text-slate-500">Loading editor...</div>}
      options={{
        fontSize: 13.5,
        fontFamily: 'JetBrains Mono, monospace',
        fontLigatures: true,
        // IntelliSense on — hover docs + completion for the Glide APIs are the
        // main teaching aid (typings come from glide-types.js).
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        tabCompletion: 'on',
        parameterHints: { enabled: true },
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 14, bottom: 14 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        renderLineHighlight: 'all',
        tabSize: 2,
        automaticLayout: true,
        wordWrap: 'on',
      }}
    />
  )
}
