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
  // 1. Rutas de Autenticación (Públicas, sin layout)
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  
  // 2. Estructura Principal del Sitio (Layout Base)
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      // Redirección inicial: Si entran a la raíz '', van directamente al feed
      { path: '', redirectTo: 'feed', pathMatch: 'full' },

      // Rutas PÚBLICAS (Visitantes pueden navegar y ver ofertas en modo lectura)
      { path: 'feed', component: FeedTrabajosComponent },
      { path: 'trabajo/:id', component: DetalleTrabajoComponent },
      { path: 'perfil/:id', component: VistaPerfilComponent },

      // Rutas PRIVADAS (Requieren inicio de sesión)
      { 
        path: 'crear-publicacion', 
        component: CrearPublicacionComponent, 
        canActivate: [authGuard] 
      },
      { 
        path: 'editar-perfil', 
        component: EditarPerfilComponent, 
        canActivate: [authGuard] 
      },
      { 
        path: 'evaluar/:id', 
        component: DejarEvaluacionComponent, 
        canActivate: [authGuard] 
      },
      
      // Paneles de Control Protegidos por Autenticación y Rol Estricto
      { 
        path: 'panel-tienda', 
        component: PanelTiendaComponent, 
        canActivate: [authGuard, roleGuard],
        data: { expectedRole: 'tienda' } 
      },
      { 
        path: 'panel-oficina', 
        component: PanelOficinaComponent, 
        canActivate: [authGuard, roleGuard],
        data: { expectedRole: 'oficina' } 
      },
      { 
        path: 'panel-funcionario', 
        component: PanelFuncionarioComponent, 
        canActivate: [authGuard, roleGuard],
        data: { expectedRole: 'funcionario' } 
      }
    ]
  },

  // 3. Comodín para cualquier URL no encontrada
  { path: '**', redirectTo: 'feed' }
];