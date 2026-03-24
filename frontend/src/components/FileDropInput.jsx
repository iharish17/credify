import { useRef, useState } from "react";

export default function FileDropInput({
  label,
  accept,
  helpText,
  file,
  onFileChange,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleFiles = (fileList) => {
    const nextFile = fileList?.[0];
    if (nextFile) {
      onFileChange(nextFile);
    }
  };

  return (
    <div
      className={`upload-card ${isDragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => {
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => handleFiles(event.target.files)}
      />
      <span className="upload-label">{label}</span>
      <p className="upload-help">{helpText}</p>
      <button type="button" className="button ghost" onClick={openPicker}>
        Choose File
      </button>
      <div className="upload-file">
        {file ? file.name : "Drag and drop a file here"}
      </div>
    </div>
  );
}
