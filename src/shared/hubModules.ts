/** Public output registry. Add preview modules here to expose them in the hub and tenant router. */
export const HUB_MODULES = [
  { id: 'max-art', domain: 'MAX-ART', title: 'MAX-ART', summary: 'Explore the art and storefront preview.', group: 'core', view: 'existing', href: '#/art' },
  { id: 'max-chess', domain: 'MAX-CHESS', title: 'MAX-CHESS', summary: 'Play and explore chess outputs.', group: 'core', view: 'existing', href: '#/chess' },
  { id: 'max-sports', domain: 'MAX-SPORTS', title: 'MAX-SPORTS', summary: 'Explore sports prediction outputs.', group: 'core', view: 'existing', href: '#/sports' },
  { id: 'max-games', domain: 'MAX-GAMES', title: 'MAX-GAMES', summary: 'Explore game and interactive output previews.', group: 'core', view: 'existing', href: '#/games' },
  { id: 'max-media', domain: 'MAX-MEDIA', title: 'MAX-MEDIA', summary: 'Explore media and publishing output previews.', group: 'core', view: 'existing', href: '#/media' },
  { id: 'max-spaces', domain: 'MAX-SPACES', title: 'MAX-SPACES', summary: 'Explore the research output space.', group: 'core', view: 'existing', href: '#/spaces/research-output' },
  { id: 'max-institute', domain: 'MAX-INSTITUTE', title: 'MAX-INSTITUTE', summary: 'Explore the institute’s research, charter and educational outputs.', group: 'open', view: 'preview', href: '#/spaces/max-institute' },
  { id: 'max-reality', domain: 'MAX-REALITY', title: 'MAX-REALITY', summary: 'Explore previews of immersive reality and spatial experiences.', group: 'open', view: 'preview', href: '#/spaces/max-reality' },
  { id: 'max-force', domain: 'MAX-FORCE', title: 'MAX-FORCE', summary: 'Explore concepts and outputs focused on force and motion.', group: 'open', view: 'preview', href: '#/spaces/max-force' },
  { id: 'max-architecture', domain: 'MAX-ARCHITECTURE', title: 'MAX-ARCHITECTURE', summary: 'Explore architectural and spatial design outputs.', group: 'open', view: 'preview', href: '#/spaces/max-architecture' },
  { id: 'max-ecosystem', domain: 'MAX-ECOSYSTEM', title: 'MAX-ECOSYSTEM', summary: 'Explore how the MAX domains connect across the ecosystem.', group: 'open', view: 'preview', href: '#/spaces/max-ecosystem' },
  { id: 'icvs', domain: 'ICVS', title: 'ICVs', summary: 'Explore an overview of the cognitive and value pathways connecting MAX modules.', group: 'open', view: 'preview', href: '#/spaces/icvs' },
] as const;
export type HubModule = (typeof HUB_MODULES)[number];
export type HubModuleId = HubModule['id'];
export type HubPreviewId = Extract<HubModule, {view: 'preview'}>['id'];
export type HubModuleDomain = HubModule['domain'];
export function findHubModule(id: string): HubModule | undefined {
  return HUB_MODULES.find(module => module.id === id);
}
