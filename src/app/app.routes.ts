import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegistroComponent } from './features/auth/registro/registro.component';
import { PanelTiendaComponent } from './features/dashboard/panel-tienda/panel-tienda.component';
import { roleGuard } from './core/guards/role-guard';
import { authGuard } from './core/guards/auth-guard';
import { PanelOficinaComponent } from './features/dashboard/panel-oficina/panel-oficina.component';
import { PanelFuncionarioComponent } from './features/dashboard/panel-funcionario/panel-funcionario.component';
import { VistaPerfilComponent } from './features/perfil/vista-perfil/vista-perfil.component';
import { FeedTrabajosComponent } from './features/publicaciones/feed-trabajos/feed-trabajos.component';
import { DetalleTrabajoComponent } from './features/publicaciones/detalle-trabajo/detalle-trabajo.component';
import { DejarEvaluacionComponent } from './features/perfil/dejar-evaluacion/dejar-evaluacion.component';
import { CrearPublicacionComponent } from './features/publicaciones/crear-publicacion/crear-publicacion.component';
import { EditarPerfilComponent } from './features/perfil/editar-perfil/editar-perfil.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';


export const routes: Routes = [
  // Rutas de Acceso (Públicas, sin barra lateral)
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  
  // Rutas Protegidas dentro del Main Layout (Con Sidebar Lateral Corporativo)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'feed', component: FeedTrabajosComponent },
      { path: 'trabajo/:id', component: DetalleTrabajoComponent },
      { path: 'perfil/:id', component: VistaPerfilComponent },
      { path: 'evaluar/:id', component: DejarEvaluacionComponent },
      { path: 'crear-publicacion', component: CrearPublicacionComponent },
      { path: 'editar-perfil', component: EditarPerfilComponent },
      
      // Paneles de Control Protegidos por Rol Estricto
      { 
        path: 'panel-tienda', 
        component: PanelTiendaComponent, 
        canActivate: [roleGuard],
        data: { expectedRole: 'tienda' } 
      },
      { 
        path: 'panel-oficina', 
        component: PanelOficinaComponent, 
        canActivate: [roleGuard],
        data: { expectedRole: 'oficina' } 
      },
      { 
        path: 'panel-funcionario', 
        component: PanelFuncionarioComponent, 
        canActivate: [roleGuard],
        data: { expectedRole: 'funcionario' } 
      }
    ]
  },

  // Ruta por defecto
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  // Comodín para URLs no encontradas
  { path: '**', redirectTo: '/login' }
];