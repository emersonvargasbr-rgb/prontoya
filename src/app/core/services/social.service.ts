import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type EstadoVinculo = 'ninguno' | 'enviado' | 'recibido' | 'conectado';

@Injectable({ providedIn: 'root' })
export class SocialService {
  constructor(private sb: SupabaseService) {}

  private get db() { return this.sb.supabase; }

  private async uid(): Promise<string> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error('Sesión no iniciada');
    return user.id;
  }

  // ------------------------------------------------------------------ FOLLOW
  async estaSiguiendo(objetivoId: string): Promise<boolean> {
    const yo = await this.uid();
    const { count } = await this.db.from('seguidores')
      .select('seguidor_id', { count: 'exact', head: true })
      .eq('seguidor_id', yo).eq('seguido_id', objetivoId);
    return (count ?? 0) > 0;
  }

  async seguir(objetivoId: string) {
    const yo = await this.uid();
    const { error } = await this.db.from('seguidores')
      .insert({ seguidor_id: yo, seguido_id: objetivoId });
    if (error && error.code !== '23505') throw error; // 23505 = ya lo seguías
  }

  async dejarDeSeguir(objetivoId: string) {
    const yo = await this.uid();
    const { error } = await this.db.from('seguidores').delete()
      .eq('seguidor_id', yo).eq('seguido_id', objetivoId);
    if (error) throw error;
  }

  async contar(perfilId: string): Promise<{ seguidores: number; siguiendo: number }> {
    const [a, b] = await Promise.all([
      this.db.from('seguidores').select('seguidor_id', { count: 'exact', head: true }).eq('seguido_id', perfilId),
      this.db.from('seguidores').select('seguido_id', { count: 'exact', head: true }).eq('seguidor_id', perfilId),
    ]);
    return { seguidores: a.count ?? 0, siguiendo: b.count ?? 0 };
  }

  // ----------------------------------------------------------------- VÍNCULOS
  async estadoVinculo(otroId: string): Promise<{ estado: EstadoVinculo; id?: string }> {
    const yo = await this.uid();
    const { data } = await this.db.from('vinculos')
      .select('id, estado, solicitante_id')
      .or(`and(solicitante_id.eq.${yo},destinatario_id.eq.${otroId}),and(solicitante_id.eq.${otroId},destinatario_id.eq.${yo})`)
      .maybeSingle();

    if (!data || data.estado === 'Rechazado') return { estado: 'ninguno' };
    if (data.estado === 'Aceptado') return { estado: 'conectado', id: data.id };
    return { estado: data.solicitante_id === yo ? 'enviado' : 'recibido', id: data.id };
  }

  async solicitarVinculo(otroId: string) {
    const yo = await this.uid();
    const { error } = await this.db.from('vinculos')
      .insert({ solicitante_id: yo, destinatario_id: otroId });
    if (error) throw error;
  }

  async responderVinculo(vinculoId: string, aceptar: boolean) {
    const { error } = await this.db.from('vinculos')
      .update({ estado: aceptar ? 'Aceptado' : 'Rechazado' }).eq('id', vinculoId);
    if (error) throw error;
  }

  async eliminarVinculo(vinculoId: string) {
    const { error } = await this.db.from('vinculos').delete().eq('id', vinculoId);
    if (error) throw error;
  }

  /** Solicitudes de vínculo que otros me enviaron y aún no respondí. */
  async solicitudesRecibidas() {
    const yo = await this.uid();
    const { data, error } = await this.db.from('vinculos')
      .select('id, created_at, solicitante:solicitante_id (id, nombre_completo, rol, zona_ubicacion, verificado)')
      .eq('destinatario_id', yo).eq('estado', 'Pendiente')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async misVinculos(perfilId: string) {
    const { data, error } = await this.db.from('vinculos')
      .select(`id,
        solicitante:solicitante_id (id, nombre_completo, rol, verificado),
        destinatario:destinatario_id (id, nombre_completo, rol, verificado)`)
      .eq('estado', 'Aceptado')
      .or(`solicitante_id.eq.${perfilId},destinatario_id.eq.${perfilId}`);
    if (error) throw error;
    // devuelve siempre "la otra persona"
    return (data ?? []).map((v: any) => {
      const s = Array.isArray(v.solicitante) ? v.solicitante[0] : v.solicitante;
      const d = Array.isArray(v.destinatario) ? v.destinatario[0] : v.destinatario;
      return { vinculoId: v.id, perfil: s?.id === perfilId ? d : s };
    });
  }
}
