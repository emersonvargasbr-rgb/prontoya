import { Component, DestroyRef, HostListener, Inject, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SesionService } from '../../core/services/sesion.service';
import { UI } from '../../core/utils/helpers';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { IconComponent } from '../../shared/components/icon.component';


/** Si tu ruta del perfil público se llama distinto, cámbiala aquí. */
const RUTA_PERFIL = '/perfil-usuario';

const PANEL: Record<string, { ruta: string; txt: string; icono: string }> = {
  tienda:      { ruta: '/panel-tienda',      txt: 'Panel de tienda',   icono: 'bag' },
  oficina:     { ruta: '/panel-oficina',     txt: 'Panel del taller',  icono: 'building' },
  funcionario: { ruta: '/panel-funcionario', txt: 'Panel de operario', icono: 'briefcase' },
};

export interface NavItem {
  ruta: string | any[];
  txt: string;
  icono: string;
  /** etiqueta corta para la barra inferior del móvil */
  corto: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent],
  templateUrl: './sidebar-dashboard.component.html',
})
export class SidebarDashboardComponent implements OnInit {
  readonly ui = UI;
  readonly rutaPerfil = RUTA_PERFIL;

  private sesion = inject(SesionService);
  private destroyRef = inject(DestroyRef);

  // la sesión es compartida con el header: se lee, no se vuelve a cargar
  usuario = this.sesion.usuario;
  logueado = this.sesion.logueado;
  g = this.sesion.g;

  expandido = signal(true);   // escritorio: ancho completo o sólo iconos
  menuMovil = signal(false);  // móvil: hoja "Más"

  items = computed<NavItem[]>(() => {
    const lista: NavItem[] = [{ ruta: '/feed', txt: 'Inicio', corto: 'Inicio', icono: 'home' }];
    const panel = PANEL[this.sesion.rol()];
    if (panel) lista.push({ ruta: panel.ruta, txt: panel.txt, corto: 'Panel', icono: panel.icono, badge: this.sesion.pendientes() });
    const u = this.usuario();
    if (u) lista.push({ ruta: [RUTA_PERFIL, u.id], txt: 'Mi perfil', corto: 'Perfil', icono: 'user' });
    return lista;
  });

  /** En el móvil el perfil tiene su propio botón, así que no va en la lista. */
  itemsMovil = computed(() => this.items().filter(i => i.corto !== 'Perfil'));

  constructor(public router: Router, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    this.sesion.iniciar();
    if (!isPlatformBrowser(this.platformId)) return;

    this.expandido.set(localStorage.getItem('sidebar_expandido') !== '0');
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.menuMovil.set(false));
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape() { this.menuMovil.set(false); }

  toggleSidebar() {
    this.expandido.update(v => !v);
    localStorage.setItem('sidebar_expandido', this.expandido() ? '1' : '0');
  }

  async cerrarSesion() {
    this.menuMovil.set(false);
    await this.sesion.cerrarSesion();
    this.router.navigate(['/login']);
  }
}