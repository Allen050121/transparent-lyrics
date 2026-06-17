import { useEffect, useRef, useState } from "react";

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onPreview,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const previewFrameRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef(value);
  const committedValueRef = useRef(value);
  const hasPendingPreviewRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
    pendingPreviewRef.current = value;
    committedValueRef.current = value;
    hasPendingPreviewRef.current = false;
  }, [value]);

  useEffect(() => () => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
    }
  }, []);

  const nextValue = (raw: string) => Number(raw);
  const previewCurrent = (next: number) => {
    pendingPreviewRef.current = next;
    hasPendingPreviewRef.current = true;
    if (previewFrameRef.current !== null) return;
    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      onPreview(pendingPreviewRef.current);
    });
  };
  const commitValue = (next: number) => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    pendingPreviewRef.current = next;
    setLocalValue(next);
    if (Object.is(committedValueRef.current, next) && !hasPendingPreviewRef.current) return;
    hasPendingPreviewRef.current = false;
    committedValueRef.current = next;
    onCommit(next);
  };
  const commitCurrent = (target: HTMLInputElement) => commitValue(nextValue(target.value));

  return (
    <label className="lyric-range">
      <span>{label}<b>{localValue}{unit}</b></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={(event) => {
          const value = nextValue(event.currentTarget.value);
          setLocalValue(value);
          previewCurrent(value);
        }}
        onPointerUp={(event) => commitCurrent(event.currentTarget)}
        onPointerCancel={(event) => commitCurrent(event.currentTarget)}
        onKeyUp={(event) => commitCurrent(event.currentTarget)}
        onBlur={(event) => commitCurrent(event.currentTarget)}
      />
    </label>
  );
}

export function ColorControl({
  label,
  value,
  onPreview,
  onCommit,
}: {
  label: string;
  value: string;
  onPreview: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const previewFrameRef = useRef<number | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef(value);
  const committedValueRef = useRef(value);
  const hasPendingPreviewRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
    pendingPreviewRef.current = value;
    committedValueRef.current = value;
    hasPendingPreviewRef.current = false;
  }, [value]);

  useEffect(() => () => {
    if (previewFrameRef.current !== null) window.cancelAnimationFrame(previewFrameRef.current);
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
  }, []);

  const commitValue = (next: string) => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    pendingPreviewRef.current = next;
    setLocalValue(next);
    if (Object.is(committedValueRef.current, next) && !hasPendingPreviewRef.current) return;
    hasPendingPreviewRef.current = false;
    committedValueRef.current = next;
    onCommit(next);
  };

  const previewValue = (next: string) => {
    pendingPreviewRef.current = next;
    hasPendingPreviewRef.current = true;
    if (previewFrameRef.current === null) {
      previewFrameRef.current = window.requestAnimationFrame(() => {
        previewFrameRef.current = null;
        onPreview(pendingPreviewRef.current);
      });
    }
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(() => commitValue(pendingPreviewRef.current), 320);
  };

  return (
    <label>
      {label}
      <input
        type="color"
        value={localValue}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setLocalValue(next);
          previewValue(next);
        }}
        onBlur={(event) => commitValue(event.currentTarget.value)}
        onKeyUp={(event) => commitValue(event.currentTarget.value)}
      />
    </label>
  );
}
