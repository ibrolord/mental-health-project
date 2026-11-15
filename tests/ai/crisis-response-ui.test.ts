import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRISIS_SUPPORT_ACTIONS } from '../../components/crisis-support-card';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

// The server marks its fixed crisis reply with model: 'safety'
// (lib/ai/model-router.ts). Every client must react to it.
describe('clients react to the server crisis response', () => {
  it('web chat shows the crisis card with call, text and directory links', () => {
    const page = read('app/chat/page.tsx');
    expect(page).toContain("if (result.model === 'safety') setCrisisSupportVisible(true)");
    expect(page).toContain('<CrisisSupportCard');
    expect(CRISIS_SUPPORT_ACTIONS.map(({ href }) => href)).toEqual([
      'tel:988',
      'sms:988',
      'tel:116123',
      'tel:131114',
    ]);
    const card = read('components/crisis-support-card.tsx');
    expect(card).toContain('https://findahelpline.com');
    expect(card).toContain('/resources#crisis');
  });

  it('mobile text chat opens the local support controls', () => {
    const chat = read('mobile/app/(tabs)/chat.tsx');
    expect(chat).toMatch(/interface ChatApiResponse \{[^}]*model\?: unknown;/);
    expect(chat).toMatch(/if \(response\.model === 'safety'\) \{\s*\/\/[^\n]*\n\s*setLocalSafetyOpen\(true\);/);
  });

  it('mobile voice opens the local support controls on both chat paths', () => {
    const voice = read('mobile/app/voice.tsx');
    expect(voice.match(/if \(chat\.model === 'safety'\) setLocalSafetyOpen\(true\);/g)).toHaveLength(2);
  });

  it('mobile support sheet links to findahelpline.com for people elsewhere', () => {
    expect(read('mobile/components/LocalSafetyActions.tsx')).toContain(
      "openAction('https://findahelpline.com')"
    );
  });
});
