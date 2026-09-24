'use client';

import React, { useRef, useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';

interface CodeRange {
  start_line: number;
  end_line: number;
  start_byte: number;
  end_byte: number;
}

interface SplitViewProps {
  studentCode: string;
  refCode: string;
  selectedStudentRange: CodeRange | null;
  selectedRefRange: CodeRange | null;
}

export default function SplitView({
  studentCode,
  refCode,
  selectedStudentRange,
  selectedRefRange,
}: SplitViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentEditorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refEditorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  
  const studentDecorationsRef = useRef<string[]>([]);
  const refDecorationsRef = useRef<string[]>([]);

  // Function to load monaco editor configurations
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

    // Clear old decorations
    studentDecorationsRef.current = editor.deltaDecorations(
      studentDecorationsRef.current,
      []
    );

    if (selectedStudentRange) {
      const { start_line, end_line } = selectedStudentRange;
      const startLine = start_line + 1; // Convert 0-indexed to 1-indexed
      const endLine = end_line + 1;

      // Add highlight decoration
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
      
      // Scroll to line
      editor.revealLineInCenter(startLine);
    }
  }, [selectedStudentRange]);

  // Update highlights in Reference Editor when selectedRefRange changes
  useEffect(() => {
    if (!refEditorRef.current || !monacoRef.current) return;
    
    const editor = refEditorRef.current;
    const monaco = monacoRef.current;

    // Clear old decorations
    refDecorationsRef.current = editor.deltaDecorations(
      refDecorationsRef.current,
      []
    );

    if (selectedRefRange) {
      const { start_line, end_line } = selectedRefRange;
      const startLine = start_line + 1;
      const endLine = end_line + 1;

      // Add orange highlight decoration
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

      // Scroll to line
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

  return (
    <div className="editor-split">
      <div className="editor-wrapper">
        <div className="editor-label">
          <span>Student Submission</span>
          <span className="editor-lang">C++</span>
        </div>
        <Editor
          height="100%"
          language="cpp"
          value={studentCode}
          options={editorOptions}
          onMount={(editor, monaco) => handleEditorDidMount(editor, monaco, 'student')}
        />
      </div>

      <div className="editor-wrapper">
        <div className="editor-label">
          <span>AI Vault Reference</span>
          <span className="editor-lang">C++</span>
        </div>
        <Editor
          height="100%"
          language="cpp"
          value={refCode}
          options={editorOptions}
          onMount={(editor, monaco) => handleEditorDidMount(editor, monaco, 'ref')}
        />
      </div>
      
      {/* Inject styling classes for Monaco Editor dynamically */}
      <style jsx global>{`
        .student-highlight-line {
          background-color: rgba(59, 130, 246, 0.12) !important;
          border-left: 3px solid var(--accent-primary) !important;
        }
        .ref-highlight-line {
          background-color: rgba(245, 158, 11, 0.12) !important;
          border-left: 3px solid var(--accent-warning) !important;
        }
      `}</style>
    </div>
  );
}
