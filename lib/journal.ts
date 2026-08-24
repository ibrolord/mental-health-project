export const JOURNAL_LIMITS = {
  title: 160,
  content: 12000,
  prompt: 500,
  tags: 12,
  tag: 32,
} as const;

export type JournalEntryKind =
  | 'freeform'
  | 'guided'
  | 'book_note'
  | 'video_note'
  | 'story_note';
export type JournalMediaType = 'book' | 'video' | 'story';

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  prompt: string | null;
  entry_kind: JournalEntryKind;
  linked_book_id: string | null;
  linked_book_title: string | null;
  linked_media_type: JournalMediaType | null;
  tags: string[];
  is_favorite: boolean;
  has_voice_recording: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalDraft {
  title: string;
  content: string;
  prompt: string;
  entryKind: JournalEntryKind;
  linkedBookId: string;
  linkedBookTitle: string;
  linkedMediaType: JournalMediaType | '';
  tags: string;
  isFavorite: boolean;
}

export interface PreparedJournalDraft {
  title: string;
  content: string;
  prompt: string | null;
  entry_kind: JournalEntryKind;
  linked_book_id: string | null;
  linked_book_title: string | null;
  linked_media_type: JournalMediaType | null;
  tags: string[];
  is_favorite: boolean;
}

export const JOURNAL_PROMPTS = [
  {
    id: 'important-now',
    title: 'What matters now',
    prompt:
      'What feels most important today? What is one part you can influence, and what can wait?',
  },
  {
    id: 'name-the-need',
    title: 'Name the need',
    prompt:
      'What happened, what did you notice in yourself, and what support or boundary might help?',
  },
  {
    id: 'small-next-step',
    title: 'One workable step',
    prompt:
      'What is one small, realistic next step? What could make it easier to begin?',
  },
  {
    id: 'self-compassion',
    title: 'A kinder response',
    prompt:
      'If someone you care about were in this situation, what balanced and compassionate response would you offer them?',
  },
] as const;

function compactWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function deriveJournalTitle(title: string, content: string): string {
  const explicitTitle = compactWhitespace(title);
  if (explicitTitle) {
    return explicitTitle.slice(0, JOURNAL_LIMITS.title);
  }

  const firstMeaningfulLine = content
    .split(/\r?\n/)
    .map(compactWhitespace)
    .find(Boolean);

  return (firstMeaningfulLine || 'Journal entry').slice(0, JOURNAL_LIMITS.title);
}

export function normalizeJournalTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of value.split(',')) {
    const tag = compactWhitespace(rawTag).slice(0, JOURNAL_LIMITS.tag);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;

    seen.add(key);
    tags.push(tag);
    if (tags.length === JOURNAL_LIMITS.tags) break;
  }

  return tags;
}

export function validateJournalDraft(
  draft: JournalDraft,
  options: { hasVoiceRecording?: boolean } = {}
): string[] {
  const errors: string[] = [];
  const content = draft.content.trim();
  const expectedMediaType = mediaTypeForEntryKind(draft.entryKind);

  if (!content && !options.hasVoiceRecording) {
    errors.push('Write something before saving.');
  } else if (content.length > JOURNAL_LIMITS.content) {
    errors.push(`Keep the entry under ${JOURNAL_LIMITS.content.toLocaleString()} characters.`);
  }

  if (draft.title.trim().length > JOURNAL_LIMITS.title) {
    errors.push(`Keep the title under ${JOURNAL_LIMITS.title} characters.`);
  }

  if (draft.prompt.length > JOURNAL_LIMITS.prompt) {
    errors.push(`Keep the prompt under ${JOURNAL_LIMITS.prompt} characters.`);
  }

  if (expectedMediaType && !draft.linkedBookId.trim()) {
    errors.push('Choose a library item before saving this note.');
  }

  if (
    draft.linkedMediaType &&
    draft.linkedMediaType !== expectedMediaType
  ) {
    errors.push('This library note does not match its source type.');
  }

  return errors;
}

export function prepareJournalDraft(draft: JournalDraft): PreparedJournalDraft {
  const linkedMediaType = mediaTypeForEntryKind(draft.entryKind);
  return {
    title: deriveJournalTitle(draft.title, draft.content),
    content: draft.content.trim(),
    prompt: draft.prompt.trim() || null,
    entry_kind: draft.entryKind,
    linked_book_id: linkedMediaType ? draft.linkedBookId.trim() || null : null,
    linked_book_title: linkedMediaType
      ? draft.linkedBookTitle.trim() || null
      : null,
    linked_media_type: linkedMediaType,
    tags: normalizeJournalTags(draft.tags),
    is_favorite: draft.isFavorite,
  };
}

function mediaTypeForEntryKind(
  entryKind: JournalEntryKind
): JournalMediaType | null {
  if (entryKind === 'book_note') return 'book';
  if (entryKind === 'video_note') return 'video';
  if (entryKind === 'story_note') return 'story';
  return null;
}

export function emptyJournalDraft(): JournalDraft {
  return {
    title: '',
    content: '',
    prompt: '',
    entryKind: 'freeform',
    linkedBookId: '',
    linkedBookTitle: '',
    linkedMediaType: '',
    tags: '',
    isFavorite: false,
  };
}
