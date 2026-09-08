'use client';

import { cn, s } from '@/app/tailwind-styles';
import type { GovernmentSignature } from '@/lib/government-signature-storage';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const SIGNATURE_WIDTH = 900;
const SIGNATURE_HEIGHT = 260;
const SIGNATURE_FONT = 'Caveat';

type SignatureModalProps = {
  signature: GovernmentSignature | null;
  remembered: boolean;
  storageAvailable: boolean;
  suggestedName: string;
  onClose: () => void;
  onErase: () => Promise<void>;
  onSave: (signature: GovernmentSignature, remember: boolean) => Promise<void>;
};

async function renderTypedSignature(name: string) {
  if (document.fonts) {
    await document.fonts.load(`700 112px ${SIGNATURE_FONT}`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = SIGNATURE_WIDTH;
  canvas.height = SIGNATURE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Signature preview could not be created.');

  let fontSize = 112;
  context.font = `700 ${fontSize}px ${SIGNATURE_FONT}, cursive`;
  while (context.measureText(name).width > SIGNATURE_WIDTH - 70 && fontSize > 48) {
    fontSize -= 4;
    context.font = `700 ${fontSize}px ${SIGNATURE_FONT}, cursive`;
  }

  context.fillStyle = '#14213d';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(name, SIGNATURE_WIDTH / 2, SIGNATURE_HEIGHT / 2 + 5);
  return canvas.toDataURL('image/png');
}

function signaturePreviewStyle(signature: GovernmentSignature) {
  return { backgroundImage: `url(${JSON.stringify(signature.imageDataUrl)})` };
}

export function SignatureModal({
  signature,
  remembered,
  storageAvailable,
  suggestedName,
  onClose,
  onErase,
  onSave,
}: SignatureModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const typedTabRef = useRef<HTMLButtonElement>(null);
  const drawnTabRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const [mode, setMode] = useState<'typed' | 'drawn'>(signature?.kind ?? 'typed');
  const [typedName, setTypedName] = useState(signature?.typedName ?? suggestedName);
  const [remember, setRemember] = useState(remembered);
  const [hasNewDrawing, setHasNewDrawing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), canvas[tabindex="0"]',
      ) ?? []).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 7;
    context.strokeStyle = '#14213d';
  }, [mode]);

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (working) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = canvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
    setHasNewDrawing(true);
    setError('');
  }

  function continueDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || pointerIdRef.current !== event.pointerId) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = canvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    drawingRef.current = false;
    pointerIdRef.current = null;
    event.currentTarget.getContext('2d')?.closePath();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearDrawing() {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasNewDrawing(false);
    setError('');
  }

  function selectMode(nextMode: 'typed' | 'drawn', focus = false) {
    setMode(nextMode);
    setError('');
    if (focus) window.requestAnimationFrame(() => (nextMode === 'typed' ? typedTabRef : drawnTabRef).current?.focus());
  }

  async function saveSignature() {
    setWorking(true);
    setError('');
    try {
      let imageDataUrl: string;
      let nextTypedName: string | null = null;

      if (mode === 'typed') {
        const name = typedName.trim();
        if (!name) throw new Error('Type your name before saving the signature.');
        imageDataUrl = await renderTypedSignature(name);
        nextTypedName = name;
      } else if (hasNewDrawing) {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Draw your signature before saving it.');
        imageDataUrl = canvas.toDataURL('image/png');
      } else if (signature?.kind === 'drawn') {
        imageDataUrl = signature.imageDataUrl;
      } else {
        throw new Error('Draw your signature before saving it.');
      }

      await onSave({
        version: 1,
        kind: mode,
        imageDataUrl,
        typedName: nextTypedName,
        updatedAt: new Date().toISOString(),
      }, remember);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'The signature could not be saved.');
    } finally {
      setWorking(false);
    }
  }

  async function eraseSignature() {
    setWorking(true);
    setError('');
    try {
      await onErase();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'The signature could not be erased.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={s.signatureOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
      <section ref={dialogRef} className={s.signatureDialog} role="dialog" aria-modal="true" aria-labelledby="signature-modal-title" aria-describedby="signature-modal-description" tabIndex={-1}>
        <button ref={closeRef} className={s.signatureClose} type="button" aria-label="Close signature dialog" disabled={working} onClick={onClose}>×</button>
        <p className={cn(s.eyebrow, s.signatureEyebrow)}><span /> YOUR SIGNATURE</p>
        <h2 id="signature-modal-title">{signature ? 'Manage your signature.' : 'Add your signature.'}</h2>
        <p className={s.signatureIntro} id="signature-modal-description">Type your name or draw with a mouse, finger, or stylus. Only the finished image is kept.</p>

        {signature && (
          <div className={s.signatureExisting}>
            <span>Current signature</span>
            <div className={s.signatureExistingImage} style={signaturePreviewStyle(signature)} role="img" aria-label="Current signature preview" />
          </div>
        )}

        <div className={s.signatureTabs} role="tablist" aria-label="Signature method">
          <button ref={typedTabRef} id="signature-tab-typed" className={mode === 'typed' ? s.signatureTabActive : undefined} type="button" role="tab" aria-selected={mode === 'typed'} aria-controls="signature-panel" tabIndex={mode === 'typed' ? 0 : -1} onClick={() => selectMode('typed')} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectMode(event.key === 'Home' ? 'typed' : event.key === 'End' ? 'drawn' : 'drawn', true); } }}>Type</button>
          <button ref={drawnTabRef} id="signature-tab-drawn" className={mode === 'drawn' ? s.signatureTabActive : undefined} type="button" role="tab" aria-selected={mode === 'drawn'} aria-controls="signature-panel" tabIndex={mode === 'drawn' ? 0 : -1} onClick={() => selectMode('drawn')} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectMode(event.key === 'End' ? 'drawn' : 'typed', true); } }}>Draw</button>
        </div>

        <div className={s.signatureEditor} id="signature-panel" role="tabpanel" aria-labelledby={mode === 'typed' ? 'signature-tab-typed' : 'signature-tab-drawn'}>
          {mode === 'typed' ? (
            <label className={s.signatureTypedLabel}>
              <span>Type your full name</span>
              <input
                autoFocus={!signature}
                value={typedName}
                maxLength={200}
                autoComplete="name"
                style={{ fontFamily: `${SIGNATURE_FONT}, cursive` }}
                onChange={(event) => { setTypedName(event.target.value); setError(''); }}
              />
            </label>
          ) : (
            <div className={s.signatureDrawArea}>
              <canvas
                ref={canvasRef}
                width={SIGNATURE_WIDTH}
                height={SIGNATURE_HEIGHT}
                tabIndex={0}
                aria-label="Draw your signature here"
                onPointerDown={startDrawing}
                onPointerMove={continueDrawing}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
              />
              <button type="button" disabled={!hasNewDrawing || working} onClick={clearDrawing}>Clear drawing</button>
            </div>
          )}
        </div>

        <label className={cn(s.signatureRemember, !storageAvailable && s.signatureRememberDisabled)}>
          <input type="checkbox" checked={remember} disabled={!storageAvailable || working} onChange={(event) => setRemember(event.target.checked)} />
          <span><strong>Remember my signature on this device</strong><small>{storageAvailable ? 'Saved in this browser using IndexedDB.' : 'Signature storage is unavailable in this browser.'}</small></span>
        </label>

        {error && <p className={s.signatureError} role="alert">{error}</p>}

        <div className={s.signatureModalActions}>
          <button className={s.signatureSave} type="button" disabled={working} onClick={() => void saveSignature()}>{working ? 'Saving…' : 'Save signature'} <span aria-hidden="true">→</span></button>
          {signature && <button className={s.signatureErase} type="button" disabled={working} onClick={() => void eraseSignature()}>Erase signature</button>}
        </div>
      </section>
    </div>
  );
}
