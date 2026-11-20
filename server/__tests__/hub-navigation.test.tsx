import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import BeemaxSpaceConcierge, { SPACE_ROUTES } from '../../src/components/BeemaxSpaceConcierge';
import { workspaceFromLocation } from '../../src/core/PortalOS1Layout';
import { HUB_MODULES, findHubModule } from '../../src/shared/hubModules';

afterEach(() => vi.unstubAllGlobals());
it('exposes every registered module with a one-click link to a working space route', () => {
  const ids = HUB_MODULES.map(module => module.id);
  const hrefs = HUB_MODULES.map(module => module.href);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(hrefs).size).toBe(hrefs.length);
  for (const module of HUB_MODULES) {
    expect(findHubModule(module.id)).toEqual(module);
    if (module.group === 'core' && module.id !== 'max-spaces') {
      expect(workspaceFromLocation(module.href, '/')).toBe(module.id.slice(4));
    } else {
      expect(Object.values(SPACE_ROUTES).some(route => route.targetRoute === module.href)).toBe(true);
      expect(workspaceFromLocation(module.href, '/')).toBe('beemax');
    }
    if (module.view === 'preview') {
      expect(module.href).toBe(`#/spaces/${module.id}`);
      expect(SPACE_ROUTES[module.id]).toMatchObject({domain:module.domain,requiresOptInUsdc:false});
    }
  }
  vi.stubGlobal('window', {location:{hash:'#/spaces/icvs'}});
  const markup = renderToStaticMarkup(<BeemaxSpaceConcierge optedInBaseUsdc={false}/>);
  expect(markup).toContain('aria-label="Max Everything module switcher"');
  for (const module of HUB_MODULES) expect(markup).toContain(`href="${module.href.replaceAll('&','&amp;')}"`);
  expect(markup).toContain('aria-current="page"');
  expect(markup.indexOf('aria-label="Selected MAX space"')).toBeLessThan(markup.indexOf('BEEMAX • MAX-SPACES Guided Navigator'));
  expect(markup).not.toContain('Opt-in Base USDC settlement');
});

it('restores the full workspace at home and keeps BEEMAX and private HUD routes separate', async () => {
  const {default: App} = await import('../../src/App');
  vi.stubGlobal('navigator', {onLine:true});
  vi.stubGlobal('document', {fullscreenElement:null, fullscreenEnabled:false});
  const renderRoute = (hash: string) => {
    vi.stubGlobal('window', {location:{hash,pathname:'/',search:'?portal_auth=1'}});
    return renderToStaticMarkup(<App/>);
  };
  const home = renderRoute('');
  expect(home).toContain('aria-label="Workspaces"');
  expect(home).toContain('Everything in');
  expect(home).toContain('BEEMAX Hub');
  expect(renderRoute('#/art')).toContain('Art without');
  expect(renderRoute('#/games')).toContain('Built to');
  expect(renderRoute('#/media')).toContain('Stories with');
  expect(renderRoute('#/sports-outputs')).toContain('MAX-SPORTS Highlights, Research &amp; Outputs');
  expect(renderRoute('#/spaces/icvs')).toContain('aria-label="Max Everything module switcher"');
  for (const hash of ['#/hud','#/portal-os1']) {
    const locked = renderRoute(hash);
    expect(locked).toContain('Private Portal-OS1 Command HUD Locked');
    expect(locked).not.toContain('PRIVATE · VERIFIED OPERATOR SESSION');
  }
});
