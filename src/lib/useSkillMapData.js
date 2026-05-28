import { useCallback, useEffect, useMemo, useState } from 'react';
import { getContext } from './context.js';
import { useActiveScope, useDefaultScopeInitializer } from './sharing.js';
import { ensureSeedTaxonomy, loadSkillMapDataset } from './skill-map-api.js';
import { buildSkillMapIndex } from './skill-map-utils.js';

const emptyDataset = {
  members: [],
  groups: [],
  skills: [],
  memberSkills: [],
  endorsements: [],
};

export function useSkillMapData() {
  useDefaultScopeInitializer();
  const activeScope = useActiveScope();
  const [ctx, setCtx] = useState(null);
  const [ctxError, setCtxError] = useState(null);
  const [dataset, setDataset] = useState(emptyDataset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    try {
      setCtx(getContext());
      setCtxError(null);
    } catch (e) {
      setCtx(null);
      setCtxError(e);
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!ctx || !activeScope.workspaceId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (activeScope.scopeKind === 'owner_member') {
          await ensureSeedTaxonomy(activeScope.workspaceId);
        }
        const next = await loadSkillMapDataset(activeScope.workspaceId);
        if (!cancelled) setDataset(next);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ctx, activeScope.scopeKind, activeScope.workspaceId, version]);

  const index = useMemo(() => buildSkillMapIndex(dataset), [dataset]);

  return {
    activeScope,
    ctx,
    ctxError,
    dataset,
    error,
    index,
    loading,
    refresh,
  };
}
