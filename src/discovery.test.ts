import { describe, expect, it } from 'vitest';
import { allNames, applyDecision, applyDiscoveryDecision, availableNames, catalog, discoveryProgress, initialState, namesForSearch, newSearch, undo, type Search } from './domain';
import { parseBackup } from './storage';
import { categories } from './categories';

function fixture(size = 2) {
  const state = initialState();
  state.settings = {...state.settings, sort: 'alphabetical'};
  state.extraCatalog = ['אבא', 'ברק'].slice(0, size).map((name, i) => ({id: `fixture:${i}`, name, genders: ['boy'], observations: [], tags: ['fixture']}));
  const search = {...newSearch(), categories: ['fixture']};
  return {state, search};
}

describe('repeating discovery rounds', () => {
  it('restarts the filtered pool, preserves likes, and undoes across a round boundary', () => {
    const {state, search} = fixture();
    const first = 'fixture:0', second = 'fixture:1';
    const a = applyDiscoveryDecision(state, search, first, 'like');
    const b = applyDiscoveryDecision(state, a, second, 'pass');
    expect(availableNames(state, b).map(n => n.id)).toEqual([first, second]);
    expect(discoveryProgress(state, b)).toMatchObject({round: 2, remaining: 2});
    expect(b.decisions[first]).toBe('like');
    expect(availableNames(state, undo(b)).map(n => n.id)).toEqual([second]);
    const c = applyDiscoveryDecision(state, b, first, 'pass');
    expect(discoveryProgress(state, c)).toMatchObject({round: 2, remaining: 1});
    expect(undo(c)).toEqual(b);
    const d = applyDiscoveryDecision(state, c, second, 'like');
    expect(discoveryProgress(state, d).round).toBe(3);
    expect(undo(undo(d))).toEqual(b);
  });

  it('handles one name, truly empty filters, and exhausted legacy backups', () => {
    const {state, search} = fixture(1);
    const completed = applyDiscoveryDecision(state, search, 'fixture:0', 'like');
    expect(availableNames(state, completed)[0].id).toBe('fixture:0');
    expect(discoveryProgress(state, completed).round).toBe(2);
    expect(undo(completed)).toEqual(search);
    expect(availableNames(state, {...search, categories: ['no-such-category']})).toEqual([]);
    const legacy = applyDecision(search, 'fixture:0', 'like');
    expect(availableNames(state, legacy)).toHaveLength(1);
    expect(undo(applyDiscoveryDecision(state, legacy, 'fixture:0', 'pass'))).toEqual(legacy);
  });

  it('persists the current round and leaves the cursor alone for shortlist edits', () => {
    const {state, search} = fixture();
    let next = applyDiscoveryDecision(state, search, 'fixture:0', 'like');
    next = applyDiscoveryDecision(state, next, 'fixture:1', 'pass');
    next = applyDiscoveryDecision(state, next, 'fixture:0', 'like');
    const saved = parseBackup(JSON.stringify({...state, searches: [next], activeId: next.id}));
    expect(availableNames(saved, saved.searches[0]).map(n => n.id)).toEqual(['fixture:1']);
    const edited = applyDecision(next, 'fixture:0', 'pass');
    expect(edited.browsing).toEqual(next.browsing);
    expect(undo(edited)).toEqual(next);
    expect(applyDiscoveryDecision(state, next, 'stale-card', 'like')).toBe(next);
    for (const browsing of [{round: 0, seen: []}, {round: 2, seen: [42]}, {round: 1.5, seen: []}]) {
      expect(() => parseBackup(JSON.stringify({...saved, searches: [{...next, browsing}]}))).toThrow('Invalid searches');
    }
  });

  it('keeps a full catalog round within browser storage limits', () => {
    const {state, search} = fixture();
    const ids = Array.from({length: 2431}, (_, i) => `cbs:${i}`);
    state.extraCatalog = ids.map(id => ({id, name: id, genders: ['boy'], observations: [], tags: ['fixture']}));
    let next: Search = {...search, browsing: {round: 1, seen: ids.slice(0, -1)}, decisions: Object.fromEntries(ids.slice(0, -1).map(id => [id, 'pass']))};
    next = applyDiscoveryDecision(state, next, ids.at(-1)!, 'like');
    for (let i = 0; i < 200; i++) next = applyDiscoveryDecision(state, next, availableNames(state, next)[0].id, 'pass');
    expect(JSON.stringify(next).length).toBeLessThan(150000);
    expect(next.history).toHaveLength(200);
  }, 15000);
});

describe('catalog themes', () => {
  it('covers every catalog spelling with valid themes and explicit unresolved cases', () => {
    const names = allNames(initialState());
    const ids = categories.map(c => c.id);
    expect(names).toHaveLength(catalog.length);
    expect(names.every(n => n.tags?.length && n.tags.every(t => ids.includes(t)))).toBe(true);
    expect(names.filter(n => n.tags?.includes('unclassified'))).not.toHaveLength(0);
    for (const [name, tag] of [['גאיה', 'mythology'], ['דיאנה', 'mythology'], ['אלון', 'nature'], ['אור', 'light'], ['דוד', 'biblical'], ['ויקטוריה', 'strength']]) {
      expect(names.find(n => n.name === name)?.tags).toContain(tag);
    }
    expect(names.find(n => n.name === 'כאזם')?.tags).not.toContain('mythology');
    expect(names.find(n => n.name === 'ג\'וליה')?.tags).not.toContain('joy');
  });

  it('honors imported and local theme edits and matches any selected category', () => {
    const {state, search} = fixture();
    state.overrides['cbs:אור'] = {tags: []};
    expect(allNames(state).find(n => n.id === 'cbs:אור')?.tags).toEqual([]);
    const names = namesForSearch(state, {...search, categories: ['nature', 'mythology'], gender: 'girl'});
    expect(names.some(n => n.name === 'דיאנה')).toBe(true);
    expect(names.every(n => n.genders.includes('girl') && n.tags?.some(t => ['nature', 'mythology'].includes(t)))).toBe(true);
  });
});
