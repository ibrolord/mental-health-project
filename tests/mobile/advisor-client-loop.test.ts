import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdvisorClientEvent } from '../../mobile/lib/advisor-client-events';

const compiled = ts.transpileModule(readFileSync('mobile/components/AdvisorClientLoop.tsx','utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
function harness(options: {loading?:boolean; owner?:string|null; os?:string; state?:string} = {}) {
  let cleanup: (() => void) | undefined;
  let appListener: (state:string) => void = () => {};
  let eventListener: (event:AdvisorClientEvent) => void = () => {};
  let profileListener = () => {};
  let healthListener = () => {};
  const refresh = vi.fn(async (_source:string) => {});
  const remove = vi.fn(); const unsubscribe = vi.fn(); const unsubscribeProfile = vi.fn(); const unsubscribeHealth = vi.fn();
  const appState = {currentState:options.state ?? 'active',addEventListener:vi.fn((_event:string,listener:(state:string)=>void) => {appListener=listener;return {remove};})};
  const owner = options.owner === undefined ? 'a' : options.owner;
  const modules: Record<string,unknown> = {
    react:{useEffect:(effect:()=>void|(()=>void)) => {cleanup=effect() ?? undefined;}},
    'react-native':{Platform:{OS:options.os??'ios'},AppState:appState},
    '@/lib/auth-context':{useAuth:()=>({user:owner?{id:owner}:null,loading:options.loading??false})},
    '@/lib/advisor-profile-storage':{advisorProfileStorage:{subscribe:(_owner:string,listener:()=>void)=>{profileListener=listener;return unsubscribeProfile;}}},
    '@/lib/apple-health-preference':{appleHealthPreference:{subscribe:(_owner:string,listener:()=>void)=>{healthListener=listener;return unsubscribeHealth;}}},
    '@/lib/advisor-client-events':{subscribeAdvisorClient:(listener:(event:AdvisorClientEvent)=>void)=>{eventListener=listener;return unsubscribe;}},
    '@/lib/advisor-client-runtime':{runAdvisorClientRefresh:refresh},
  };
  const exports = {AdvisorClientLoop:()=>{}};
  new Function('require','exports',compiled)((name:string)=>{
    if (!(name in modules)) throw new Error(`Missing ${name}`);
    return modules[name];
  },exports);
  exports.AdvisorClientLoop();
  return {refresh,remove,unsubscribe,unsubscribeProfile,unsubscribeHealth,
    change:(event:AdvisorClientEvent)=>eventListener(event),profile:()=>profileListener(),health:()=>healthListener(),
    transition:(state:string)=>{appState.currentState=state;appListener(state);},unmount:()=>cleanup?.(),appState};
}
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

describe('app-wide Advisor loop events',()=>{
  it('coalesces profile, Health-access and data changes without continuous polling',async()=>{
    const h=harness(); h.profile(); h.health(); h.change({ownerKey:'user_id:a',kind:'changed'});
    await vi.advanceTimersByTimeAsync(350); expect(h.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60*60*1000); expect(h.refresh).toHaveBeenCalledTimes(1); h.unmount();
  });
  it('ignores another profile and its own refreshed event',async()=>{
    const h=harness(); await vi.advanceTimersByTimeAsync(350);
    h.change({ownerKey:'user_id:b',kind:'changed'});h.change({ownerKey:'user_id:a',kind:'refreshed'});
    await vi.advanceTimersByTimeAsync(350); expect(h.refresh).toHaveBeenCalledTimes(1);h.unmount();
  });
  it('refreshes after foregrounding instead of running changes while backgrounded',async()=>{
    const h=harness({state:'background'});h.profile();await vi.advanceTimersByTimeAsync(350);
    expect(h.refresh).not.toHaveBeenCalled();h.transition('active');await vi.advanceTimersByTimeAsync(350);
    expect(h.refresh).toHaveBeenCalledOnce();h.unmount();
  });
  it('removes all listeners and queued work when the owner unmounts',async()=>{
    const h=harness();h.unmount();await vi.advanceTimersByTimeAsync(350);
    expect(h.refresh).not.toHaveBeenCalled();
    for(const fn of [h.remove,h.unsubscribe,h.unsubscribeProfile,h.unsubscribeHealth]) expect(fn).toHaveBeenCalledOnce();
  });
  it.each([{loading:true},{owner:null},{os:'android'}])('does not start outside the ready iOS owner: %j',async(options)=>{
    const h=harness(options);await vi.advanceTimersByTimeAsync(350);
    expect(h.refresh).not.toHaveBeenCalled();expect(h.appState.addEventListener).not.toHaveBeenCalled();
  });
  it('does not turn a native failure into an unhandled rejection or polling storm',async()=>{
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    const h=harness();h.refresh.mockRejectedValueOnce(new Error('locked device'));
    await vi.advanceTimersByTimeAsync(60*60*1000);expect(h.refresh).toHaveBeenCalledOnce();
    h.transition('background');h.transition('active');await vi.advanceTimersByTimeAsync(350);
    expect(h.refresh).toHaveBeenCalledTimes(2);h.unmount();
  });
});
