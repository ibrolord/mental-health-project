import {
  CURATED_LIBRARY,
  type CuratedBook,
  type LibraryActionType,
  type LibraryIntegration,
  type LibraryTopic,
} from './editorial';
import { CURATED_STORIES, type CuratedStory } from './stories';
import { CURATED_VIDEOS, type CuratedVideo } from './videos';

export type LibraryMediaType = 'book' | 'video' | 'story';
export type LibraryMediaFilter = 'all' | LibraryMediaType | 'saved' | 'next';

export type BookLibraryItem = CuratedBook & {
  mediaType: 'book';
  creator: string;
  durationLabel: string;
};

export type VideoLibraryItem = CuratedVideo & {
  mediaType: 'video';
  durationLabel: string;
};

export type StoryLibraryItem = CuratedStory & {
  mediaType: 'story';
  durationLabel: string;
};

export type LibraryItem =
  | BookLibraryItem
  | VideoLibraryItem
  | StoryLibraryItem;

export type LibraryTemplateFilter = 'all' | LibraryActionType;

export interface BookPracticeTemplate {
  id: string;
  book: BookLibraryItem;
  integration: LibraryIntegration;
}

export interface LibraryFilterInput {
  query: string;
  topic: LibraryTopic;
  media: LibraryMediaFilter;
  savedIds?: ReadonlySet<string>;
  nextIds?: ReadonlySet<string>;
}

export function isVideoItem(item: LibraryItem): item is VideoLibraryItem {
  return item.mediaType === 'video';
}

export function isBookItem(item: LibraryItem): item is BookLibraryItem {
  return item.mediaType === 'book';
}

export function isStoryItem(item: LibraryItem): item is StoryLibraryItem {
  return item.mediaType === 'story';
}

export const BOOK_LIBRARY_ITEMS: BookLibraryItem[] = CURATED_LIBRARY.map((book) => ({
  ...book,
  mediaType: 'book',
  creator: book.author,
  durationLabel: `${book.read_time_minutes} min guide`,
}));

function hasTemplateContent(integration: LibraryIntegration): boolean {
  if (integration.actionType === 'journal') return Boolean(integration.prompt?.trim());
  if (integration.actionType === 'goal') return Boolean(integration.goalContent?.trim());
  return Boolean(integration.habitName?.trim());
}

export const BOOK_PRACTICE_TEMPLATES: BookPracticeTemplate[] = BOOK_LIBRARY_ITEMS.flatMap(
  (book) =>
    book.integrations
      .filter(hasTemplateContent)
      .map((integration, index) => ({
        id: `${book.id}:${integration.actionType}:${index}`,
        book,
        integration,
      }))
);

export const VIDEO_LIBRARY_ITEMS: VideoLibraryItem[] = CURATED_VIDEOS.map((video) => ({
  ...video,
  mediaType: 'video',
  durationLabel: `${video.provider} talk`,
}));

export const STORY_LIBRARY_ITEMS: StoryLibraryItem[] = CURATED_STORIES.map((story) => ({
  ...story,
  mediaType: 'story',
  durationLabel: `${story.storySections.length}-part profile`,
}));

export const UNIFIED_LIBRARY: LibraryItem[] = [
  ...BOOK_LIBRARY_ITEMS,
  ...VIDEO_LIBRARY_ITEMS,
  ...STORY_LIBRARY_ITEMS,
].sort((a, b) => a.title.localeCompare(b.title));

export function filterLibraryItems(
  items: readonly LibraryItem[],
  { query, topic, media, savedIds = new Set(), nextIds = new Set() }: LibraryFilterInput
): LibraryItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return items.filter((item) => {
    if (topic !== 'All' && item.topic !== topic) return false;
    if (media === 'book' && item.mediaType !== 'book') return false;
    if (media === 'video' && item.mediaType !== 'video') return false;
    if (media === 'story' && item.mediaType !== 'story') return false;
    if (media === 'saved' && !savedIds.has(item.id)) return false;
    if (media === 'next' && !nextIds.has(item.id)) return false;
    if (!normalizedQuery) return true;

    const searchable = [
      item.title,
      item.creator,
      item.summary,
      item.centralPremise,
      item.topic,
      item.mediaType,
      ...item.displayTags,
      ...item.practicalTakeaways.flatMap(({ title, description, nextStep }) => [
        title,
        description,
        nextStep,
      ]),
      ...item.reflectionPrompts,
    ];

    if (isBookItem(item)) {
      searchable.push(
        ...item.corePremises.flatMap(({ title, premise, whyItMatters, practice }) => [
          title,
          premise,
          whyItMatters,
          practice,
        ])
      );
    }

    if (isStoryItem(item)) {
      searchable.push(
        item.location,
        item.provider,
        item.sourceFormat,
        ...item.storySections.flatMap(({ heading, body }) => [heading, body]),
        ...item.timeline.flatMap(({ period, title, description }) => [
          period,
          title,
          description,
        ])
      );
    }

    return searchable.some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function filterBookPracticeTemplates(
  templates: readonly BookPracticeTemplate[],
  {
    query,
    topic,
    action,
  }: {
    query: string;
    topic: LibraryTopic;
    action: LibraryTemplateFilter;
  }
): BookPracticeTemplate[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return templates.filter(({ book, integration }) => {
    if (topic !== 'All' && book.topic !== topic) return false;
    if (action !== 'all' && integration.actionType !== action) return false;
    if (!normalizedQuery) return true;

    return [
      book.title,
      book.author,
      book.topic,
      ...book.displayTags,
      integration.title,
      integration.description,
      integration.actionType,
      integration.prompt,
      integration.goalContent,
      integration.habitName,
      integration.habitDescription,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
  });
}
