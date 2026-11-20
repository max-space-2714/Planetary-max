/** Public, output-only previews. No tenant or operator data is stored here. */
export const HUB_MODULES = [
  { id: 'max-institute', domain: 'MAX-INSTITUTE', title: 'MAX-INSTITUTE', summary: 'Explore the institute’s research, charter and educational outputs.' },
  { id: 'max-reality', domain: 'MAX-REALITY', title: 'MAX-REALITY', summary: 'Explore previews of immersive reality and spatial experiences.' },
  { id: 'max-force', domain: 'MAX-FORCE', title: 'MAX-FORCE', summary: 'Explore concepts and outputs focused on force and motion.' },
  { id: 'max-architecture', domain: 'MAX-ARCHITECTURE', title: 'MAX-ARCHITECTURE', summary: 'Explore architectural and spatial design outputs.' },
  { id: 'max-ecosystem', domain: 'MAX-ECOSYSTEM', title: 'MAX-ECOSYSTEM', summary: 'Explore how the MAX domains connect across the ecosystem.' },
] as const;
export type HubModule = (typeof HUB_MODULES)[number];
export type HubModuleId = HubModule['id'];
export type HubModuleDomain = HubModule['domain'];
export function findHubModule(id: string): HubModule | undefined {
  return HUB_MODULES.find(module => module.id === id);
}
