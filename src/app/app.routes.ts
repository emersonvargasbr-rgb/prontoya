import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegistroComponent } from './features/auth/registro/registro.component';
import { PanelTiendaComponent } from './features/dashboard/panel-tienda/panel-tienda.component';
import { roleGuard } from './core/guards/role-guard';
import { authGuard } from './core/guards/auth-guard';
import { adminGuard } from './core/guards/admin-guard'; // <--- Importar guard
import { PanelOficinaComponent } from './features/dashboard/panel-oficina/panel-oficina.component';
import { PanelFuncionarioComponent } from './features/dashboard/panel-funcionario/panel-funcionario.component';
import { VistaPerfilComponent } from './features/perfil/vista-perfil/vista-perfil.component';
import { FeedTrabajosComponent } from './features/publicaciones/feed-trabajos/feed-trabajos.component';
import { DetalleTrabajoComponent } from './features/publicaciones/detalle-trabajo/detalle-trabajo.component';
import { DejarEvaluacionComponent } from './features/perfil/dejar-evaluacion/dejar-evaluacion.component';
import { CrearPublicacionComponent } from './features/publicaciones/crear-publicacion/crear-publicacion.component';
import { EditarPerfilComponent } from './features/perfil/editar-perfil/editar-perfil.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { PlanesComponent } from './features/planes/planes.component';
import { CheckoutSuscripcionComponent } from './features/planes/checkout-suscripcion.component';
import { AdminSuscripcionesComponent } from './features/admin/suscripciones/admin-suscripciones.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },

  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', redirectTo: 'feed', pathMatch: 'full' },

      { path: 'feed', component: FeedTrabajosComponent },
      { path: 'trabajo/:id', component: DetalleTrabajoComponent },

      { path: 'perfil/:id', component: VistaPerfilComponent },
      { path: 'perfil-usuario/:id', component: VistaPerfilComponent },

      {
        path: 'planes',
        component: PlanesComponent,
        canActivate: [authGuard],
      },
      {
        path: 'checkout-suscripcion',
        component: CheckoutSuscripcionComponent,
        canActivate: [authGuard],
      },
      { path: 'suscripcion', redirectTo: 'planes', pathMatch: 'full' },

      // RUTA DE ADMINISTRACIÓN DE SUSCRIPCIONES
      {
        path: 'admin/suscripciones',
        component: AdminSuscripcionesComponent,
        canActivate: [adminGuard],
      },

      {
        path: 'crear-publicacion',
        component: CrearPublicacionComponent,
        canActivate: [authGuard],
      },
      {
        path: 'editar-perfil',
        component: EditarPerfilComponent,
        canActivate: [authGuard],
      },
      {
        path: 'evaluar/:id',
        component: DejarEvaluacionComponent,
        canActivate: [authGuard],
      },

      {
        path: 'panel-tienda',
        component: PanelTiendaComponent,
        canActivate: [authGuard, roleGuard],
        data: { expectedRole: 'tienda' },
      },
      {
        path: 'panel-oficina',
        component: PanelOficinaComponent,
        canActivate: [authGuard, roleGuard],
        data: { expectedRole: 'oficina' },
      },
      {
        path: 'panel-funcionario',
        component: PanelFuncionarioComponent,
        canActivate: [authGuard, roleGuard],
        data: { expectedRole: 'funcionario' },
      },
    ],
  },

  { path: '**', redirectTo: 'feed' },
];