import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'trabajo/:id', renderMode: RenderMode.Client },
  { path: 'perfil/:id', renderMode: RenderMode.Client },
  { path: 'perfil-usuario/:id', renderMode: RenderMode.Client },
  { path: 'evaluar/:id', renderMode: RenderMode.Client },
  { path: 'dejar-evaluacion/:id', renderMode: RenderMode.Client },
  { path: 'admin/suscripciones', renderMode: RenderMode.Client },
  { path: 'checkout-suscripcion', renderMode: RenderMode.Client },
  { path: 'verificar-documento', renderMode: RenderMode.Client },
  { path: 'mis-ingresos', renderMode: RenderMode.Client },
  { path: 'lotes-activos', renderMode: RenderMode.Client },
  { path: 'historial-lotes', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
