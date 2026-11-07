import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { SidebarDashboardComponent } from '../sidebar-dashboard/sidebar-dashboard.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, SidebarDashboardComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {}