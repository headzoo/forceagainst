'use client';

import { cn, s } from '@/app/tailwind-styles';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';

const LETTER_STORAGE_KEY = 'forceAgainstSomething:letterBuilder:v1';

type Position = '' | 'support' | 'oppose';

type LetterFields = {
  position: Position;
  billNumber: string;
  billAuthor: string;
  topic: string;
  fullName: string;
  constituency: string;
  reason: string;
  details: string;
  request: string;
  signature: string;
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
  contactFormUrl: string | null;
  officialWebsite: string | null;
  defaultConstituency: string;
};

type LetterBuilderProps = {
  member: LetterMember;
  dateLabel: string;
};

type EditableFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  displayValue?: string;
  multiline?: boolean;
  choices?: Array<{ value: string; label: string }>;
};

const PROFILE_KEYS = [
  'fullName',
  'constituency',
  'signature',
  'streetAddress',
  'cityStateZip',
  'contact',
] as const satisfies readonly (keyof LetterFields)[];

const DRAFT_KEYS = [
  'position',
  'billNumber',
  'billAuthor',
  'topic',
  'reason',
  'details',
  'request',
] as const satisfies readonly (keyof LetterFields)[];

const REQUIRED_KEYS = [
  'position',
  'billNumber',
  'billAuthor',
  'topic',
  'fullName',
  'constituency',
  'reason',
  'details',
  'request',
  'signature',
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
    if (key === 'position') {
      if (trimmed === 'support' || trimmed === 'oppose' || trimmed === '') {
        result.position = trimmed;
      }
      continue;
    }
    Object.assign(result, { [key]: trimmed });
  }
  return result;
}

function blankFields(member: LetterMember): LetterFields {
  return {
    position: '',
    billNumber: '',
    billAuthor: '',
    topic: '',
    fullName: '',
    constituency: member.defaultConstituency,
    reason: '',
    details: '',
    request: '',
    signature: '',
    streetAddress: '',
    cityStateZip: '',
    contact: '',
  };
}

function positionPhrase(position: Position) {
  if (position === 'support') return 'In support of';
  if (position === 'oppose') return 'In opposition to';
  return '[support or opposition to]';
}

function positionVerb(position: Position) {
  if (position === 'support') return 'support';
  if (position === 'oppose') return 'oppose';
  return '[support or oppose]';
}

function buildSubject(fields: LetterFields) {
  return `${positionPhrase(fields.position)} ${fields.billNumber} by ${fields.billAuthor} regarding ${fields.topic}`;
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
    `My name is ${fields.fullName}, and I am a constituent of ${fields.constituency} writing to you regarding ${fields.billNumber} by ${fields.billAuthor} regarding ${fields.topic}. I ${positionVerb(fields.position)} this bill because ${fields.reason}`,
    '',
    fields.details,
    '',
    `${fields.request} Thank you for your time.`,
    '',
    'Sincerely,',
    '',
    fields.signature,
    fields.fullName,
    fields.streetAddress,
    fields.cityStateZip,
    fields.contact,
  ].join('\n');
}

function pdfSafeText(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '?');
}

function EditableField({
  label,
  placeholder,
  value,
  onChange,
  displayValue,
  multiline = false,
  choices,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const controlRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) controlRef.current?.focus();
  }, [editing]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    if (event.key === 'Escape' || (!multiline && event.key === 'Enter')) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  if (editing) {
    if (choices) {
      return (
        <select
          ref={controlRef as RefObject<HTMLSelectElement | null>}
          className={s.letterFieldControl}
          aria-label={label}
          value={value}
          onBlur={() => setEditing(false)}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        >
          <option value="">Choose one</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>{choice.label}</option>
          ))}
        </select>
      );
    }

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
      {displayValue || value || `[${placeholder}]`}
    </button>
  );
}

export function LetterBuilder({ member, dateLabel }: LetterBuilderProps) {
  const [fields, setFields] = useState<LetterFields>(() => blankFields(member));
  const [restored, setRestored] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Preparing private draft storage…');
  const [actionStatus, setActionStatus] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(LETTER_STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as unknown;
          if (isRecord(stored)) {
            const profile = safeFields(stored.profile, PROFILE_KEYS);
            const drafts = isRecord(stored.drafts) ? stored.drafts : {};
            const draft = safeFields(drafts[member.bioguideId], DRAFT_KEYS);
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
  }, [member.bioguideId]);

  useEffect(() => {
    if (!restored) return;

    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(LETTER_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) as unknown : null;
        const existingDrafts = isRecord(parsed) && isRecord(parsed.drafts) ? parsed.drafts : {};
        const drafts = Object.fromEntries(
          Object.entries(existingDrafts)
            .filter(([key, value]) => /^[A-Z]\d{6}$/i.test(key) && isRecord(value))
            .slice(-24),
        );

        drafts[member.bioguideId] = Object.fromEntries(DRAFT_KEYS.map((key) => [key, fields[key]]));
        const profile = Object.fromEntries(PROFILE_KEYS.map((key) => [key, fields[key]]));
        window.localStorage.setItem(LETTER_STORAGE_KEY, JSON.stringify({ profile, drafts }));
        setSaveStatus('Saved on this device.');
      } catch {
        setSaveStatus('Draft could not be saved in this browser.');
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fields, member.bioguideId, restored]);

  function updateField<K extends keyof LetterFields>(key: K, value: LetterFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setActionStatus('');
    setSaveStatus('Saving on this device…');
  }

  function clearSavedDraft() {
    try {
      window.localStorage.removeItem(LETTER_STORAGE_KEY);
    } catch {
      // State can still be reset even if storage removal is blocked.
    }
    setFields(blankFields(member));
    setActionStatus('Saved letter information cleared.');
    setSaveStatus('Draft will save on this device.');
  }

  const missingFields = REQUIRED_KEYS.filter((key) => !fields[key].trim());
  const complete = missingFields.length === 0;
  const subject = buildSubject(fields);
  const letterText = buildLetterText(member, dateLabel, fields);
  const contactUrl = member.contactFormUrl ?? member.officialWebsite;

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
    if (!complete || generatingPdf) return;
    setGeneratingPdf(true);
    setActionStatus('Building your PDF…');

    try {
      const { jsPDF } = await import('jspdf');
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
        creator: 'Force Against Something',
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

      addText(dateLabel, { gapAfter: 32 });
      addText(`The Honorable ${member.officialFullName}`, { bold: true, gapAfter: 2 });
      addText(member.recipientAddress, { gapAfter: 25 });
      addText(`RE: ${subject}`, { bold: true, gapAfter: 25 });
      addText(`Dear ${member.displayTitle} ${member.lastName}:`, { gapAfter: 25 });
      addText(`My name is ${fields.fullName}, and I am a constituent of ${fields.constituency} writing to you regarding ${fields.billNumber} by ${fields.billAuthor} regarding ${fields.topic}. I ${positionVerb(fields.position)} this bill because ${fields.reason}`, { gapAfter: 18 });
      addText(fields.details, { gapAfter: 18 });
      addText(`${fields.request} Thank you for your time.`, { gapAfter: 25 });
      addText('Sincerely,', { gapAfter: 32 });
      addText(fields.signature, { gapAfter: 2 });
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
            label="position on the bill"
            placeholder="support or opposition to"
            value={fields.position}
            displayValue={positionPhrase(fields.position)}
            choices={[
              { value: 'support', label: 'In support of' },
              { value: 'oppose', label: 'In opposition to' },
            ]}
            onChange={(value) => updateField('position', value as Position)}
          />{' '}
          <EditableField label="bill number" placeholder="bill number" value={fields.billNumber} onChange={(value) => updateField('billNumber', value)} />{' '}
          by{' '}
          <EditableField label="bill author" placeholder="author" value={fields.billAuthor} onChange={(value) => updateField('billAuthor', value)} />{' '}
          regarding{' '}
          <EditableField label="bill topic" placeholder="topic" value={fields.topic} onChange={(value) => updateField('topic', value)} />
        </p>

        <p>Dear {member.displayTitle} {member.lastName}:</p>

        <p>
          My name is{' '}
          <EditableField label="your full name" placeholder="your first and last name" value={fields.fullName} onChange={(value) => updateField('fullName', value)} />,
          {' '}and I am a constituent of{' '}
          <EditableField label="your district or state" placeholder="your district or state" value={fields.constituency} onChange={(value) => updateField('constituency', value)} />{' '}
          writing to you regarding{' '}
          <EditableField label="bill number" placeholder="bill number" value={fields.billNumber} onChange={(value) => updateField('billNumber', value)} />{' '}
          by{' '}
          <EditableField label="bill author" placeholder="author" value={fields.billAuthor} onChange={(value) => updateField('billAuthor', value)} />{' '}
          regarding{' '}
          <EditableField label="bill topic" placeholder="topic" value={fields.topic} onChange={(value) => updateField('topic', value)} />. I{' '}
          <EditableField
            label="position on the bill"
            placeholder="support or oppose"
            value={fields.position}
            displayValue={positionVerb(fields.position)}
            choices={[
              { value: 'support', label: 'support' },
              { value: 'oppose', label: 'oppose' },
            ]}
            onChange={(value) => updateField('position', value as Position)}
          />{' '}
          this bill because{' '}
          <EditableField label="your reason" placeholder="insert your reason here" value={fields.reason} onChange={(value) => updateField('reason', value)} />
        </p>

        <EditableField
          label="specific facts and personal examples"
          placeholder="provide specific, factual information and personal examples about how this bill affects you, people you know, or your community"
          value={fields.details}
          multiline
          onChange={(value) => updateField('details', value)}
        />

        <p>
          <EditableField
            label="the action you want the legislator to take"
            placeholder="restate your concern and request a specific action, such as voting for or against the bill"
            value={fields.request}
            multiline
            onChange={(value) => updateField('request', value)}
          />{' '}
          Thank you for your time.
        </p>

        <div className={s.letterClosing}>
          <p>Sincerely,</p>
          <EditableField label="your signature" placeholder="sign your name" value={fields.signature} onChange={(value) => updateField('signature', value)} />
          <EditableField label="your printed name" placeholder="print your name" value={fields.fullName} onChange={(value) => updateField('fullName', value)} />
          <EditableField label="your street address" placeholder="street address" value={fields.streetAddress} onChange={(value) => updateField('streetAddress', value)} />
          <EditableField label="your city, state, and ZIP code" placeholder="city, state, ZIP code" value={fields.cityStateZip} onChange={(value) => updateField('cityStateZip', value)} />
          <EditableField label="your email or phone number" placeholder="email or phone number" value={fields.contact} onChange={(value) => updateField('contact', value)} />
        </div>
      </article>

      <aside className={s.letterActions}>
        <p className={cn(s.eyebrow, s.letterActionsEyebrow)}><span /> FINISH YOUR LETTER</p>
        <h2>{complete ? 'Ready to send.' : `${missingFields.length} field${missingFields.length === 1 ? '' : 's'} left.`}</h2>
        <p className={s.letterProgressCopy}>
          {complete
            ? 'Your letter is complete. Download the PDF or copy the text for the government contact form.'
            : 'Outlined fields are editable. Complete each one before exporting the letter.'}
        </p>

        <div className={s.letterActionButtons}>
          <button className={s.letterActionPrimary} type="button" disabled={!complete || generatingPdf} onClick={() => void downloadPdf()}>
            <span>{generatingPdf ? 'Building PDF…' : 'Download PDF'}</span>
            <span aria-hidden="true">↓</span>
          </button>
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
          <p>Your entries are stored in this browser, not in our database. They leave your device only when you paste them into a government contact form.</p>
          <p role="status" aria-live="polite">{saveStatus}</p>
          <button type="button" onClick={clearSavedDraft}>Clear saved letter information</button>
        </div>

        {actionStatus && <p className={s.letterActionStatus} role="status" aria-live="polite">{actionStatus}</p>}
      </aside>
    </section>
  );
}
