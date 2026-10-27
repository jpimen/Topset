import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface EditableGridCellProps {
  row: number;
  column: number;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  onClear?: () => void;
  options?: readonly string[];
  inputOptions?: readonly string[];
  className?: string;
  placeholder?: string;
}

export function focusProgramGridCell(row: number, column: number) {
  document.querySelector<HTMLElement>(`[data-grid-cell="${row}:${column}"] button, [data-grid-cell="${row}:${column}"] input, [data-grid-cell="${row}:${column}"] select`)
    ?.focus();
}

export function EditableGridCell({ row, column, label, value, onCommit, onClear, options, inputOptions, className = '', placeholder = '—' }: EditableGridCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const cancelled = useRef(false);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (draft !== value && draft !== lastCommitted.current) {
      lastCommitted.current = draft;
      onCommit(draft);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>) => {
    if (editing) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelled.current = true;
        setDraft(value);
        setEditing(false);
        window.requestAnimationFrame(() => focusProgramGridCell(row, column));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        commit();
        setEditing(false);
        window.requestAnimationFrame(() => focusProgramGridCell(row + 1, column));
      } else if (event.key === 'Tab') {
        event.preventDefault();
        commit();
        setEditing(false);
        window.requestAnimationFrame(() => focusProgramGridCell(row, column + (event.shiftKey ? -1 : 1)));
      }
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      cancelled.current = false;
      lastCommitted.current = value;
      setEditing(true);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onClear?.();
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      if (event.key === 'ArrowDown') focusProgramGridCell(row + 1, column);
      if (event.key === 'ArrowUp') focusProgramGridCell(row - 1, column);
      if (event.key === 'ArrowRight') focusProgramGridCell(row, column + 1);
      if (event.key === 'ArrowLeft') focusProgramGridCell(row, column - 1);
    }
  };

  return (
    <div role="gridcell" data-grid-cell={`${row}:${column}`} className={`builder-cell ${className}`}>
      {editing ? options ? (
        <select ref={inputRef as React.RefObject<HTMLSelectElement>} aria-label={label} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={handleKeyDown}>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <>
          <input ref={inputRef as React.RefObject<HTMLInputElement>} aria-label={label} list={inputOptions ? `grid-options-${row}-${column}` : undefined} value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={handleKeyDown} />
          {inputOptions && <datalist id={`grid-options-${row}-${column}`}>{inputOptions.map((option) => <option key={option} value={option} />)}</datalist>}
        </>
      ) : (
        <button type="button" aria-label={`${label}: ${value || 'empty'}`} onClick={() => { cancelled.current = false; lastCommitted.current = value; setEditing(true); }} onKeyDown={handleKeyDown}>
          {value || <span className="builder-cell-placeholder">{placeholder}</span>}
        </button>
      )}
    </div>
  );
}
