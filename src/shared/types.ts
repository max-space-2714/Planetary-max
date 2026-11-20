export type Workspace = 'overview' | 'beemax' | 'art' | 'chess' | 'sports' | 'sports-outputs' | 'games' | 'media';
export interface Artwork { id: string; title: string; artist: string; medium: string; year: string; palette: string; category: 'Abstract' | 'Digital' | 'Mixed media'; }
export interface BetSelection { id: string; event: string; pick: string; odds: number; }
export interface TelemetryPoint { label: string; value: string; unit: string; }
