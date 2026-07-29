import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const mobilePlanner = fs.readFileSync(
  path.join(root, 'mobile/app/planner.tsx'),
  'utf8'
);
const webPlanner = fs.readFileSync(path.join(root, 'app/planner/page.tsx'), 'utf8');

describe('life planner status actions', () => {
  it('lets paused native items resume or complete', () => {
    expect(mobilePlanner).toContain(
      "label={item.status === 'paused' ? 'Resume' : 'Make active'}"
    );
    expect(mobilePlanner).toContain("item.status === 'paused' ? (");
    expect(mobilePlanner).toContain(
      "onPress={() => void changeStatus(item, 'active')}"
    );
    expect(mobilePlanner).toContain(
      "onPress={() => void changeStatus(item, 'complete')}"
    );
  });

  it('uses the same paused-state language on the web', () => {
    expect(webPlanner).toContain(
      "{item.status === 'paused' ? 'Resume' : 'Make active'}"
    );
  });
});
