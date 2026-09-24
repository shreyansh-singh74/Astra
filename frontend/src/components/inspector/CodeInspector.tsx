'use client';

import React, { useRef, useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { FileCode, Sparkles } from 'lucide-react';

interface CodeRange {
  start_line: number;
  end_line: number;
  start_byte: number;
  end_byte: number;
}

interface CodeInspectorProps {
  studentCode: string;
  refCode: string;
  selectedStudentRange: CodeRange | null;
  selectedRefRange: CodeRange | null;
  modelName: string;
}

export default function CodeInspector({
  studentCode,
  refCode,
  selectedStudentRange,
  selectedRefRange,
  modelName,
}: CodeInspectorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentEditorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refEditorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const studentDecorationsRef = useRef<string[]>([]);
  const refDecorationsRef = useRef<string[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEditorDidMount(editor: any, monaco: Monaco, type: 'student' | 'ref') {
    if (type === 'student') {
      studentEditorRef.current = editor;
    } else {
      refEditorRef.current = editor;
    }
    monacoRef.current = monaco;
  }

  // Update highlights in Student Editor when selectedStudentRange changes
  useEffect(() => {
    if (!studentEditorRef.current || !monacoRef.current) return;

    const editor = studentEditorRef.current;
    const monaco = monacoRef.current;

    studentDecorationsRef.current = editor.deltaDecorations(
      studentDecorationsRef.current,
      []
    );

    if (selectedStudentRange) {
      const startLine = selectedStudentRange.start_line + 1;
      const endLine = selectedStudentRange.end_line + 1;

      studentDecorationsRef.current = editor.deltaDecorations(
        [],
        [
          {
            range: new monaco.Range(startLine, 1, endLine, 100),
            options: {
              isWholeLine: true,
              className: 'student-highlight-line',
              glyphMarginClassName: 'student-highlight-glyph',
            },
          },
        ]
      );

      editor.revealLineInCenter(startLine);
    }
  }, [selectedStudentRange]);

  // Update highlights in Reference Editor when selectedRefRange changes
  useEffect(() => {
    if (!refEditorRef.current || !monacoRef.current) return;

    const editor = refEditorRef.current;
    const monaco = monacoRef.current;

    refDecorationsRef.current = editor.deltaDecorations(
      refDecorationsRef.current,
      []
    );

    if (selectedRefRange) {
      const startLine = selectedRefRange.start_line + 1;
      const endLine = selectedRefRange.end_line + 1;

      refDecorationsRef.current = editor.deltaDecorations(
        [],
        [
          {
            range: new monaco.Range(startLine, 1, endLine, 100),
            options: {
              isWholeLine: true,
              className: 'ref-highlight-line',
              glyphMarginClassName: 'ref-highlight-glyph',
            },
          },
        ]
      );

      editor.revealLineInCenter(startLine);
    }
  }, [selectedRefRange]);

  const editorOptions = {
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    lineHeight: 20,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    theme: 'vs-dark',
    domReadOnly: true,
  };

  const studentLineCount = studentCode ? studentCode.split('\n').length : 0;
  const refLineCount = refCode ? refCode.split('\n').length : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', height: '520px' }}>
      {/* Student Code Window */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '0.65rem 1rem',
          backgroundColor: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileCode size={16} className="text-accent-primary" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Student Submission
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {studentLineCount} lines
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>C++</span>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <Editor
            height="100%"
            language="cpp"
            value={studentCode}
            options={editorOptions}
            onMount={(editor, monaco) => handleEditorDidMount(editor, monaco, 'student')}
          />
        </div>
      </div>

      {/* AI Reference Code Window */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '0.65rem 1rem',
          backgroundColor: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-warning)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {modelName} Reference Sample
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
              {refLineCount} lines
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>C++</span>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <Editor
            height="100%"
            language="cpp"
            value={refCode}
            options={editorOptions}
            onMount={(editor, monaco) => handleEditorDidMount(editor, monaco, 'ref')}
          />
        </div>
      </div>
    </div>
  );
}
