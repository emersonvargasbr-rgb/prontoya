import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { SidebarDashboardComponent } from '../sidebar-dashboard/sidebar-dashboard.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    SidebarDashboardComponent,
    HeaderComponent,
  ],
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent {
  private authService = inject(AuthService);

  perfil = this.authService.perfil;

  estadoVerificacion = computed(() => {
    const p = this.perfil();
    if (!p || p.verificado) return null;

    const inicio = p.created_at ? new Date(p.created_at).getTime() : Date.now();
    const diasTranscurridos = Math.max(
      0,
      Math.floor((Date.now() - inicio) / (1000 * 60 * 60 * 24))
    );
    const diasRestantes = Math.max(0, 30 - diasTranscurridos);

    return {
      diasTranscurridos,
      diasRestantes,
      vencido: diasTranscurridos >= 30,
    };
  });
}