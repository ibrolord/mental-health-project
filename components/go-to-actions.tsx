'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GO_TO_ACTION_LIMIT,
  GO_TO_CUE_LIMIT,
  GO_TO_TOOLS,
  getGoToTool,
  sanitizeGoToActions,
  type GoToAction,
  type GoToToolId,
} from '@/lib/wellbeing/go-to-actions';
import { loadGoToActions, saveGoToActions } from '@/lib/go-to-actions-storage';

type Props = {
  ownerKey: string | null;
};

function moveAction(actions: GoToAction[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= actions.length) return actions;
  const next = [...actions];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function GoToActions({ ownerKey }: Props) {
  const router = useRouter();
  const [actions, setActions] = useState<GoToAction[]>(() => sanitizeGoToActions(null));
  const [draft, setDraft] = useState<GoToAction[]>(actions);
  const [editing, setEditing] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!ownerKey) return;
    const loaded = loadGoToActions(ownerKey);
    setActions(loaded);
    setDraft(loaded);
    setEditing(false);
    setStorageError(false);
    setReady(true);
  }, [ownerKey]);

  const toggleTool = (toolId: GoToToolId) => {
    setDraft((current) => {
      const selected = current.some((action) => action.toolId === toolId);
      if (selected) {
        return current.length === 1
          ? current
          : current.filter((action) => action.toolId !== toolId);
      }
      if (current.length >= GO_TO_ACTION_LIMIT) return current;
      return [...current, { toolId, cue: '' }];
    });
  };

  const save = () => {
    const next = sanitizeGoToActions(draft);
    const persisted = saveGoToActions(ownerKey, next);
    setActions(next);
    setDraft(next);
    setStorageError(!persisted);
    setEditing(false);
  };

  if (!ready) {
    return (
      <section className="app-panel p-5" aria-busy="true">
        <h2 className="font-display text-2xl font-medium text-foreground">My go-to actions</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading your actions…</p>
      </section>
    );
  }

  return (
    <section className="app-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-medium text-foreground">
            My go-to actions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep the tools you use most within reach.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!ownerKey}
          aria-expanded={editing}
          onClick={() => {
            setDraft(actions);
            setEditing((current) => !current);
            setStorageError(false);
          }}
        >
          {editing ? <X className="mr-2 h-4 w-4" /> : <Settings2 className="mr-2 h-4 w-4" />}
          {editing ? 'Close' : 'Customize'}
        </Button>
      </div>

      {editing ? (
        <div className="mt-5 space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold text-foreground">
              Choose one to three
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {GO_TO_TOOLS.map((tool) => {
                const selected = draft.some((action) => action.toolId === tool.id);
                const disabled = !selected && draft.length >= GO_TO_ACTION_LIMIT;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => toggleTool(tool.id)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-secondary'
                    }`}
                  >
                    {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                    {tool.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-3">
            {draft.map((action, index) => {
              const tool = getGoToTool(action.toolId);
              return (
                <div key={action.toolId} className="rounded-2xl bg-secondary/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{tool.label}</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        aria-label={`Move ${tool.label} up`}
                        onClick={() => setDraft((current) => moveAction(current, index, -1))}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === draft.length - 1}
                        aria-label={`Move ${tool.label} down`}
                        onClick={() => setDraft((current) => moveAction(current, index, 1))}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-muted-foreground">
                    When I notice… <span className="font-normal">(optional)</span>
                    <Input
                      className="mt-1.5 bg-background"
                      maxLength={GO_TO_CUE_LIMIT}
                      value={action.cue}
                      placeholder="for example, my thoughts are racing"
                      onChange={(event) => {
                        const cue = event.target.value;
                        setDraft((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, cue } : item
                          )
                        );
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={save} disabled={!ownerKey}>
              Save actions
            </Button>
            <p className="text-xs text-muted-foreground">Saved only on this device.</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {actions.map((action) => {
            const tool = getGoToTool(action.toolId);
            return (
              <button
                key={action.toolId}
                type="button"
                onClick={() => router.push(tool.href)}
                className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl bg-secondary/55 px-4 py-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>
                  <span className="block font-semibold text-foreground">{tool.label}</span>
                  {action.cue && (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      When I notice {action.cue}
                    </span>
                  )}
                </span>
                <span aria-hidden="true" className="text-primary">→</span>
              </button>
            );
          })}
        </div>
      )}

      {storageError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Changes could not be saved and may be lost when you leave this view.
        </p>
      )}
    </section>
  );
}
