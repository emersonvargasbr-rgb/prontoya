import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-sidebar-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-dashboard.component.html',
  styleUrls: ['./sidebar-dashboard.component.css']
})
export class SidebarDashboardComponent implements OnInit {
  rolUsuario: string = '';
  cargando = true;

  constructor(
    private supabaseService: SupabaseService, 
    private router: Router,
    private cdr: ChangeDetectorRef // 👈 Inyección para forzar render inmediato y evitar NG0100
  ) {}

  async ngOnInit() {
    try {
      const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
      if (user) {
        const { data } = await this.supabaseService.supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .single();
        
        if (data) {
          this.rolUsuario = data.rol;
        }
      }
    } catch (error) {
      console.error('Error cargando rol en el sidebar:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 Rompe el ciclo de bloqueo y actualiza el menú al instante
    }
  }

  async cerrarSesion() {
    await this.supabaseService.supabase.auth.signOut();
    this.router.navigate(['/login']);
  }
}