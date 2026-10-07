'use client';

import React, { useState } from 'react';
import { UploadCloud, CheckCircle } from 'lucide-react';

interface UploadDropzoneProps {
  onFileLoaded: (codeText: string, filename: string) => void;
  isComparing: boolean;
}

export default function UploadDropzone({ onFileLoaded, isComparing }: UploadDropzoneProps) {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    const text = await file.text();
    setLoadedFileName(file.name);
    onFileLoaded(text, file.name);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <label 
      className={`dropzone ${dragActive ? 'active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".cpp,.cxx,.cc,.c,.h,.hpp,.py,.java"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={isComparing}
      />
      {loadedFileName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-success)' }}>
          <CheckCircle size={22} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{loadedFileName} loaded</span>
        </div>
      ) : (
        <>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
          }}>
            <UploadCloud size={20} />
          </div>
          <div>
            <div className="dropzone-title">Drop student C++ source file here</div>
            <div className="dropzone-desc">or click to browse (.cpp files)</div>
          </div>
        </>
      )}
    </label>
  );
}
