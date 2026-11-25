MapCN adapted subset, MIT: https://github.com/AnmolSaini16/mapcn
Upstream reviewed at fd8ce8f7581a80376d7a9426364edeed17c99f35, registry https://mapcn.dev/r/map.json (17/11/2026).
PAW keeps Map context, one-time Map lifecycle, composable controls and React portal popups. Removed theme/CDN styles, external worker URL, unused route/arc/cluster components. Worker is bundled by Vite; the only basemap source is explicitly added from the PAW imagery catalog. License is retained in LICENSE. Components use PAW CSS instead of assuming shadcn theme variables. No Google/OSM/Carto network fallback.
