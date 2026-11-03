import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'trabajo/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'perfil/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'evaluar/:id',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];