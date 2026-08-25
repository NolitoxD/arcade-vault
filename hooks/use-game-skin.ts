'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import { isUnlocked, requiredCredits, resolveSkin } from '@/lib/credits';
import {
  getSkinOptions,
  type GameId,
  type SkinDef,
} from '@/lib/games-registry';

export type SkinOption = SkinDef & {
  locked: boolean;
  requiredCredits: number;
  lockedLabel: string;
};

export function useGameSkin(id: GameId): {
  skinKey: string;
  options: SkinOption[];
  change: (key: string) => void;
} {
  const { credits } = useUser();
  const skins = getSkinOptions(id);
  const storageKey = `${id}-skin`;
  const baseKey = skins.find((skin) => skin.tier === 'base')?.key ?? '';
  const [skinKey, setSkinKey] = useState(baseKey);

  const options = useMemo<SkinOption[]>(
    () =>
      skins.map((skin) => {
        const needed = requiredCredits(skin.tier);
        return {
          ...skin,
          locked: !isUnlocked(skin.tier, credits),
          requiredCredits: needed,
          lockedLabel: `🔒 ${skin.label.toUpperCase()} · ${needed} créditos`,
        };
      }),
    [skins, credits],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkinKey(resolveSkin(skins, localStorage.getItem(storageKey), credits));
  }, [skins, storageKey, credits]);

  const change = useCallback(
    (key: string) => {
      const option = skins.find((skin) => skin.key === key);
      if (!option || !isUnlocked(option.tier, credits)) return;
      localStorage.setItem(storageKey, key);
      setSkinKey(key);
    },
    [skins, storageKey, credits],
  );

  return { skinKey, options, change };
}
