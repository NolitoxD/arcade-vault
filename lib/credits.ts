export type SkinTier = 'base' | 'retro' | 'neon' | 'extra';

export type Rank = 'INVITADO' | 'NOVATO' | 'JUGADOR' | 'VETERANO' | 'MAESTRO DEL VAULT';

export const THRESHOLDS: Record<Exclude<SkinTier, 'base'>, number> = {
  retro: 3,
  neon: 6,
  extra: 9,
};

const TIER_ORDER: Exclude<SkinTier, 'base'>[] = ['retro', 'neon', 'extra'];

export function requiredCredits(tier: SkinTier): number {
  return tier === 'base' ? 0 : THRESHOLDS[tier];
}

export function isUnlocked(tier: SkinTier, credits: number | null): boolean {
  if (tier === 'base') return true;
  if (credits === null) return false;
  return credits >= THRESHOLDS[tier];
}

export function getRank(credits: number | null, catalogSize: number): Rank {
  if (credits === null) return 'INVITADO';
  if (catalogSize > 0 && credits >= catalogSize) return 'MAESTRO DEL VAULT';
  if (credits >= THRESHOLDS.neon) return 'VETERANO';
  if (credits >= THRESHOLDS.retro) return 'JUGADOR';
  return 'NOVATO';
}

export function getStars(credits: number | null): string {
  const reached = credits === null ? 0 : TIER_ORDER.filter((tier) => credits >= THRESHOLDS[tier]).length;
  return '★'.repeat(reached).padEnd(3, '☆');
}

export function resolveSkin(
  skins: { key: string; tier: SkinTier }[],
  savedKey: string | null,
  credits: number | null,
): string {
  const baseKey = skins.find((skin) => skin.tier === 'base')?.key ?? '';
  if (savedKey === null) return baseKey;
  const saved = skins.find((skin) => skin.key === savedKey);
  if (saved && isUnlocked(saved.tier, credits)) return saved.key;
  return baseKey;
}

export function crossedTiers(before: number | null, after: number | null): SkinTier[] {
  if (after === null) return [];
  const from = before ?? 0;
  return TIER_ORDER.filter((tier) => THRESHOLDS[tier] > from && THRESHOLDS[tier] <= after);
}
