'use client';

import { cn, s } from '@/app/tailwind-styles';
import {
  deleteStoredGovernmentSignature,
  readStoredGovernmentSignature,
  saveStoredGovernmentSignature,
  type GovernmentSignature,
} from '@/lib/government-signature-storage';
import type { GovernmentActionContext } from '@/lib/government-action-context';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';
import { SignatureModal } from './signature-modal';

const LETTER_STORAGE_KEY = 'forceAgainst:letterBuilder:v1';

type LetterFields = {
  subject: string;
  fullName: string;
  constituency: string;
  reason: string;
  details: string;
  request: string;
  streetAddress: string;
  cityStateZip: string;
  contact: string;
};

type LetterMember = {
  bioguideId: string;
  officialFullName: string;
  lastName: string;
  displayTitle: string;
  chamber: 'house' | 'senate';
  recipientAddress: string;
  mailingAddress: string;
  contactFormUrl: string | null;
  officialWebsite: string | null;
  defaultConstituency: string;
};

type LetterBuilderProps = {
  member: LetterMember;
  dateLabel: string;
  actionContext?: GovernmentActionContext;
};

type EditableFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
};

const PROFILE_KEYS = [
  'fullName',
  'streetAddress',
  'cityStateZip',
  'contact',
] as const satisfies readonly (keyof LetterFields)[];

const DRAFT_KEYS = [
  'subject',
  'constituency',
  'reason',
  'details',
  'request',
] as const satisfies readonly (keyof LetterFields)[];

const REQUIRED_KEYS = [
  'subject',
  'fullName',
  'constituency',
  'reason',
  'details',
  'request',
  'streetAddress',
  'cityStateZip',
  'contact',
] as const satisfies readonly (keyof LetterFields)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeFields(
  value: unknown,
  keys: readonly (keyof LetterFields)[],
): Partial<LetterFields> {
  if (!isRecord(value)) return {};

  const result: Partial<LetterFields> = {};
  for (const key of keys) {
    const field = value[key];
    if (typeof field !== 'string') continue;
    const trimmed = field.slice(0, 8_000);
    Object.assign(result, { [key]: trimmed });
  }
  return result;
}

function blankFields(member: LetterMember, actionContext?: GovernmentActionContext): LetterFields {
  return {
    subject: actionContext?.subject ?? '',
    fullName: '',
    constituency: member.defaultConstituency,
    reason: '',
    details: actionContext?.background ?? '',
    request: actionContext?.request ?? '',
    streetAddress: '',
    cityStateZip: '',
    contact: '',
  };
}

function buildSubject(fields: LetterFields) {
  return fields.subject;
}

function buildLetterText(member: LetterMember, dateLabel: string, fields: LetterFields) {
  return [
    dateLabel,
    '',
    `The Honorable ${member.officialFullName}`,
    member.recipientAddress,
    '',
    `RE: ${buildSubject(fields)}`,
    '',
    `Dear ${member.displayTitle} ${member.lastName}:`,
    '',
    `My name is ${fields.fullName}, and I am a constituent of ${fields.constituency}. I am writing to you about ${fields.subject}. This matters to me because ${fields.reason}.`,
    '',
    fields.details,
    '',
    `${fields.request} Thank you for your time and consideration.`,
    '',
    'Sincerely,',
    '',
    fields.fullName,
    fields.streetAddress,
    fields.cityStateZip,
    fields.contact,
  ].join('\n');
}

function formatMailingAddress(address: string) {
  return address
    .trim()
    .replace(/\s+(Washington)\s+(DC)\s+(\d{5}(?:-\d{4})?)$/i, '\n$1, $2 $3');
}

function pdfSafeText(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '?');
}

async function trimSignatureForPdf(imageDataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error('The signature image could not be prepared.'));
    nextImage.src = imageDataUrl;
  });
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) throw new Error('The signature image could not be prepared.');
  sourceContext.drawImage(image, 0, 0);

  const pixels = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data;
  let minX = sourceWidth;
  let minY = sourceHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      if (pixels[(y * sourceWidth + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const maximumWidth = 150;
  const maximumHeight = 43;
  if (maxX < minX || maxY < minY) {
    return { imageDataUrl, width: maximumWidth, height: maximumHeight };
  }

  const padding = 2;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(sourceWidth, maxX + padding + 1) - cropX;
  const cropHeight = Math.min(sourceHeight, maxY + padding + 1) - cropY;
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedContext = croppedCanvas.getContext('2d');
  if (!croppedContext) throw new Error('The signature image could not be prepared.');
  croppedContext.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  const scale = Math.min(maximumWidth / sourceWidth, maximumHeight / sourceHeight);
  return {
    imageDataUrl: croppedCanvas.toDataURL('image/png'),
    width: cropWidth * scale,
    height: cropHeight * scale,
  };
}

function EditableField({
  label,
  placeholder,
  value,
  onChange,
  multiline = false,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const controlRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) controlRef.current?.focus();
  }, [editing]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === 'Escape' || (!multiline && event.key === 'Enter')) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={controlRef as RefObject<HTMLTextAreaElement | null>}
          className={cn(s.letterFieldControl, s.letterFieldTextarea)}
          aria-label={label}
          value={value}
          rows={5}
          maxLength={8_000}
          onBlur={() => setEditing(false)}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
      );
    }

    return (
      <input
        ref={controlRef as RefObject<HTMLInputElement | null>}
        className={s.letterFieldControl}
        aria-label={label}
        value={value}
        maxLength={500}
        onBlur={() => setEditing(false)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <button
      className={cn(s.letterField, multiline && s.letterFieldBlock, value.trim() && s.letterFieldFilled)}
      type="button"
      aria-label={`Edit ${label}`}
      onClick={() => setEditing(true)}
    >
      {value || `[${placeholder}]`}
    </button>
  );
}

type SignatureFieldProps = {
  signature: GovernmentSignature | null;
  onOpen: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

function signaturePreviewStyle(signature: GovernmentSignature) {
  return { backgroundImage: `url(${JSON.stringify(signature.imageDataUrl)})` };
}

function SignatureField({ signature, onOpen }: SignatureFieldProps) {
  return (
    <div className={s.signatureFieldRow}>
      <button
        className={cn(s.letterField, s.signatureField, signature && s.letterFieldFilled)}
        type="button"
        aria-label={signature ? 'Manage your signature' : 'Add your signature'}
        onClick={onOpen}
      >
        {signature ? (
          <span className={s.signatureFieldImage} style={signaturePreviewStyle(signature)} aria-hidden="true" />
        ) : '[add your signature]'}
      </button>
      {signature && <button className={s.signatureManageButton} type="button" onClick={onOpen}>Manage signature</button>}
    </div>
  );
}

export function LetterBuilder({ member, dateLabel, actionContext }: LetterBuilderProps) {
  const draftKey = actionContext
    ? `${member.bioguideId}:action:${actionContext.id}`
    : `${member.bioguideId}:general`;
  const [fields, setFields] = useState<LetterFields>(() => blankFields(member, actionContext));
  const [signature, setSignature] = useState<GovernmentSignature | null>(null);
  const [signatureRemembered, setSignatureRemembered] = useState(false);
  const [signatureStorageAvailable, setSignatureStorageAvailable] = useState(true);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Preparing private draft storage…');
  const [actionStatus, setActionStatus] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const signatureTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(LETTER_STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as unknown;
          if (isRecord(stored)) {
            const profile = safeFields(stored.profile, PROFILE_KEYS);
            const drafts = isRecord(stored.drafts) ? stored.drafts : {};
            const savedDraft = drafts[draftKey] ?? (actionContext ? undefined : drafts[member.bioguideId]);
            const draft = safeFields(savedDraft, DRAFT_KEYS);
            setFields((current) => ({ ...current, ...profile, ...draft }));
            setSaveStatus('Draft restored from this device.');
          }
        } else {
          setSaveStatus('Draft will save on this device.');
        }
      } catch {
        try {
          window.localStorage.removeItem(LETTER_STORAGE_KEY);
        } catch {
          // The builder still works when browser storage is restricted.
        }
        setSaveStatus('Private draft storage is unavailable in this browser.');
      } finally {
        setRestored(true);
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [actionContext, draftKey, member.bioguideId]);

  useEffect(() => {
    let cancelled = false;
    void readStoredGovernmentSignature()
      .then((storedSignature) => {
        if (cancelled || !storedSignature) return;
        setSignature(storedSignature);
        setSignatureRemembered(true);
      })
      .catch(() => {
        if (!cancelled) setSignatureStorageAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restored) return;

    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(LETTER_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) as unknown : null;
        const existingDrafts = isRecord(parsed) && isRecord(parsed.drafts) ? parsed.drafts : {};
        const drafts = Object.fromEntries(
          Object.entries(existingDrafts)
            .filter(([key, value]) => /^[A-Z]\d{6}(?::(?:general|action:\d+))?$/i.test(key) && isRecord(value))
            .slice(-23),
        );

        drafts[draftKey] = Object.fromEntries(DRAFT_KEYS.map((key) => [key, fields[key]]));
        const profile = Object.fromEntries(PROFILE_KEYS.map((key) => [key, fields[key]]));
        window.localStorage.setItem(LETTER_STORAGE_KEY, JSON.stringify({ profile, drafts }));
        setSaveStatus('Saved on this device.');
      } catch {
        setSaveStatus('Draft could not be saved in this browser.');
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [draftKey, fields, restored]);

  function updateField<K extends keyof LetterFields>(key: K, value: LetterFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setActionStatus('');
    setSaveStatus('Saving on this device…');
  }

  const closeSignatureModal = useCallback(() => {
    setSignatureOpen(false);
    window.requestAnimationFrame(() => signatureTriggerRef.current?.focus());
  }, []);

  function openSignatureModal(event: ReactMouseEvent<HTMLButtonElement>) {
    signatureTriggerRef.current = event.currentTarget;
    setActionStatus('');
    setSignatureOpen(true);
  }

  async function saveSignature(nextSignature: GovernmentSignature, remember: boolean) {
    if (remember) {
      await saveStoredGovernmentSignature(nextSignature);
    } else if (signatureRemembered) {
      await deleteStoredGovernmentSignature();
    }

    setSignature(nextSignature);
    setSignatureRemembered(remember);
    setActionStatus(remember ? 'Signature saved and remembered on this device.' : 'Signature saved for this visit.');
    closeSignatureModal();
  }

  async function eraseSignature() {
    if (signatureRemembered) await deleteStoredGovernmentSignature();
    setSignature(null);
    setSignatureRemembered(false);
    setActionStatus('Signature erased.');
    closeSignatureModal();
  }

  async function clearSavedDraft() {
    let storageCleared = true;
    try {
      window.localStorage.removeItem(LETTER_STORAGE_KEY);
    } catch {
      storageCleared = false;
    }
    try {
      await deleteStoredGovernmentSignature();
    } catch {
      storageCleared = false;
    }
    setFields(blankFields(member, actionContext));
    setSignature(null);
    setSignatureRemembered(false);
    setActionStatus(storageCleared ? 'Saved letter information cleared.' : 'This letter was cleared, but some saved browser data could not be removed.');
    setSaveStatus('Draft will save on this device.');
  }

  const missingFields = REQUIRED_KEYS.filter((key) => !fields[key].trim());
  const missingFieldCount = missingFields.length + (signature ? 0 : 1);
  const complete = missingFieldCount === 0;
  const subject = buildSubject(fields);
  const letterText = buildLetterText(member, dateLabel, fields);
  const contactUrl = member.contactFormUrl ?? member.officialWebsite;
  const mailingAddress = formatMailingAddress(member.mailingAddress);

  async function copyLetter() {
    const value = `Subject: ${subject}\n\n${letterText}`;
    try {
      await navigator.clipboard.writeText(value);
      setActionStatus('Letter copied. Paste it into the representative’s government contact form.');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand('copy');
      textArea.remove();
      setActionStatus(copied ? 'Letter copied. Paste it into the representative’s government contact form.' : 'Copy failed. Select the letter text and copy it manually.');
    }
  }

  async function downloadPdf() {
    if (!complete || !signature || generatingPdf) return;
    setGeneratingPdf(true);
    setActionStatus('Building your PDF…');

    try {
      const { jsPDF } = await import('jspdf');
      const trimmedSignature = await trimSignatureForPdf(signature.imageDataUrl);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 68;
      const contentWidth = pageWidth - margin * 2;
      const lineHeight = 15;
      let y = margin;

      pdf.setProperties({
        title: subject,
        subject,
        author: fields.fullName,
        creator: 'Force Against',
      });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(20, 33, 61);

      function addText(text: string, options: { bold?: boolean; gapAfter?: number } = {}) {
        pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
        const lines = pdf.splitTextToSize(pdfSafeText(text), contentWidth) as string[];
        for (const line of lines) {
          if (y + lineHeight > pageHeight - margin) {
            pdf.addPage('letter', 'portrait');
            y = margin;
          }
          pdf.text(line, margin, y);
          y += lineHeight;
        }
        y += options.gapAfter ?? lineHeight;
      }

      function addSignatureImage() {
        if (y + trimmedSignature.height > pageHeight - margin) {
          pdf.addPage('letter', 'portrait');
          y = margin;
        }
        pdf.addImage(
          trimmedSignature.imageDataUrl,
          'PNG',
          margin,
          y,
          trimmedSignature.width,
          trimmedSignature.height,
          undefined,
          'FAST',
        );
        y += trimmedSignature.height + 9;
      }

      addText(dateLabel, { gapAfter: 32 });
      addText(`The Honorable ${member.officialFullName}`, { bold: true, gapAfter: 2 });
      addText(member.recipientAddress, { gapAfter: 25 });
      addText(`RE: ${subject}`, { bold: true, gapAfter: 25 });
      addText(`Dear ${member.displayTitle} ${member.lastName}:`, { gapAfter: 25 });
      addText(`My name is ${fields.fullName}, and I am a constituent of ${fields.constituency}. I am writing to you about ${fields.subject}. This matters to me because ${fields.reason}.`, { gapAfter: 18 });
      addText(fields.details, { gapAfter: 18 });
      addText(`${fields.request} Thank you for your time and consideration.`, { gapAfter: 25 });
      addText('Sincerely,', { gapAfter: 12 });
      addSignatureImage();
      addText(fields.fullName, { gapAfter: 2 });
      addText(fields.streetAddress, { gapAfter: 2 });
      addText(fields.cityStateZip, { gapAfter: 2 });
      addText(fields.contact, { gapAfter: 0 });

      const filename = `letter-to-${member.lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      pdf.save(`${filename || 'representative'}.pdf`);
      setActionStatus('PDF downloaded.');
    } catch {
      setActionStatus('The PDF could not be generated. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <>
      <section className={s.letterBuilderShell} aria-label={`Letter to ${member.officialFullName}`}>
      <article className={s.letterPaper}>
        <p className={s.letterDate}>{dateLabel}</p>

        <address className={s.letterRecipient}>
          <strong>The Honorable {member.officialFullName}</strong>
          {'\n'}{member.recipientAddress}
        </address>

        <p className={s.letterSubject}>
          <strong>RE:</strong>{' '}
          <EditableField
            label="the issue or reason for writing"
            placeholder="the issue or reason you are writing"
            value={fields.subject}
            onChange={(value) => updateField('subject', value)}
          />
        </p>

        <p>Dear {member.displayTitle} {member.lastName}:</p>

        <p>
          My name is{' '}
          <EditableField label="your full name" placeholder="your first and last name" value={fields.fullName} onChange={(value) => updateField('fullName', value)} />,
          {' '}and I am a constituent of{' '}
          <EditableField label="your district or state" placeholder="your district or state" value={fields.constituency} onChange={(value) => updateField('constituency', value)} />.
          {' '}I am writing to you about{' '}
          <EditableField label="the issue or reason for writing" placeholder="the issue or reason you are writing" value={fields.subject} onChange={(value) => updateField('subject', value)} />.
          {' '}This matters to me because{' '}
          <EditableField label="why this matters to you" placeholder="explain why this matters to you" value={fields.reason} onChange={(value) => updateField('reason', value)} />.
        </p>

        <EditableField
          label="specific facts and personal examples"
          placeholder="provide specific facts, personal experiences, or examples that explain your concern and how it affects you or your community"
          value={fields.details}
          multiline
          onChange={(value) => updateField('details', value)}
        />

        <p>
          <EditableField
            label="the action you want the legislator to take"
            placeholder="explain the specific action you would like your representative to take"
            value={fields.request}
            multiline
            onChange={(value) => updateField('request', value)}
          />{' '}
          Thank you for your time and consideration.
        </p>

        <div className={s.letterClosing}>
          <p>Sincerely,</p>
          <SignatureField signature={signature} onOpen={openSignatureModal} />
          <EditableField label="your printed name" placeholder="print your name" value={fields.fullName} onChange={(value) => updateField('fullName', value)} />
          <EditableField label="your street address" placeholder="street address" value={fields.streetAddress} onChange={(value) => updateField('streetAddress', value)} />
          <EditableField label="your city, state, and ZIP code" placeholder="city, state, ZIP code" value={fields.cityStateZip} onChange={(value) => updateField('cityStateZip', value)} />
          <EditableField label="your email or phone number" placeholder="email or phone number" value={fields.contact} onChange={(value) => updateField('contact', value)} />
        </div>
      </article>

      <aside className={s.letterActions}>
        <p className={cn(s.eyebrow, s.letterActionsEyebrow)}><span /> FINISH YOUR LETTER</p>
        <h2>{complete ? 'Ready to send.' : `${missingFieldCount} field${missingFieldCount === 1 ? '' : 's'} left.`}</h2>
        <p className={s.letterProgressCopy}>
          {complete
            ? 'Your letter is complete. Download the PDF or copy the text for the government contact form.'
            : 'Outlined fields are editable. Complete each one before exporting the letter.'}
        </p>

        <div className={s.letterPdfPath}>
          <button className={s.letterActionPrimary} type="button" disabled={!complete || generatingPdf} onClick={() => void downloadPdf()}>
            <span>{generatingPdf ? 'Building PDF…' : 'Download PDF'}</span>
            <span aria-hidden="true">↓</span>
          </button>
          <address>{mailingAddress}</address>
        </div>

        <div className={s.letterActionButtons}>
          <button type="button" disabled={!complete} onClick={() => void copyLetter()}>
            <span>Copy Letter</span>
            <span aria-hidden="true">⧉</span>
          </button>
        </div>

        <div className={s.letterContactFallback}>
          <p>After copying, paste the letter into the representative’s government contact form.</p>
          {contactUrl && (
            <a href={contactUrl} target="_blank" rel="noopener noreferrer">
              Open {member.displayTitle} {member.lastName}’s government site →
            </a>
          )}
        </div>

        <div className={s.letterPrivacyNote}>
          <strong>Private by default.</strong>
          <p>Your entries and any remembered signature are stored in this browser, not in our database. They leave your device only when you paste them into a government contact form.</p>
          <p role="status" aria-live="polite">{saveStatus}</p>
          <button type="button" onClick={() => void clearSavedDraft()}>Clear saved letter information</button>
        </div>

        {actionStatus && <p className={s.letterActionStatus} role="status" aria-live="polite">{actionStatus}</p>}
        </aside>
      </section>

      {signatureOpen && (
        <SignatureModal
          signature={signature}
          remembered={signatureRemembered}
          storageAvailable={signatureStorageAvailable}
          suggestedName={fields.fullName}
          onClose={closeSignatureModal}
          onErase={eraseSignature}
          onSave={saveSignature}
        />
      )}
    </>
  );
}
