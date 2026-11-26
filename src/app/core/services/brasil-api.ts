import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type TipoDocumentoBr = 'cpf' | 'cnpj' | null;

export interface ResultadoDocumentoBr {
  valido: boolean;
  tipo: TipoDocumentoBr;
  documentoLimpio: string;
  documentoFormateado: string;
  razonSocial?: string;
  nombreFantasia?: string;
  situacion?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BrasilApi {
  private readonly http = inject(HttpClient);

  limpiarDocumento(valor: string | null | undefined): string {
    return (valor ?? '').replace(/\D+/g, '');
  }

  detectarTipo(valor: string | null | undefined): TipoDocumentoBr {
    const limpio = this.limpiarDocumento(valor);
    if (limpio.length === 11) return 'cpf';
    if (limpio.length === 14) return 'cnpj';
    return null;
  }

  formatearDocumento(valor: string | null | undefined): string {
    const limpio = this.limpiarDocumento(valor);
    if (limpio.length === 11) {
      return limpio.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (limpio.length === 14) {
      return limpio.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        '$1.$2.$3/$4-$5'
      );
    }
    return limpio;
  }

  validarCpf(valor: string | null | undefined): boolean {
    const cpf = this.limpiarDocumento(valor);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let suma = 0;
    for (let i = 0; i < 9; i++) {
      suma += Number(cpf[i]) * (10 - i);
    }
    let digito1 = (suma * 10) % 11;
    if (digito1 === 10) digito1 = 0;
    if (digito1 !== Number(cpf[9])) return false;

    suma = 0;
    for (let i = 0; i < 10; i++) {
      suma += Number(cpf[i]) * (11 - i);
    }
    let digito2 = (suma * 10) % 11;
    if (digito2 === 10) digito2 = 0;
    return digito2 === Number(cpf[10]);
  }

  validarCnpj(valor: string | null | undefined): boolean {
    const cnpj = this.limpiarDocumento(valor);
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 12; i++) {
      suma += Number(cnpj[i]) * pesos1[i];
    }
    let resto = suma % 11;
    const digito1 = resto < 2 ? 0 : 11 - resto;
    if (digito1 !== Number(cnpj[12])) return false;

    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    suma = 0;
    for (let i = 0; i < 13; i++) {
      suma += Number(cnpj[i]) * pesos2[i];
    }
    resto = suma % 11;
    const digito2 = resto < 2 ? 0 : 11 - resto;
    return digito2 === Number(cnpj[13]);
  }

  validarLocal(valor: string | null | undefined): ResultadoDocumentoBr {
    const limpio = this.limpiarDocumento(valor);
    const tipo = this.detectarTipo(limpio);
    const formateado = this.formatearDocumento(limpio);

    if (tipo === 'cpf') {
      const ok = this.validarCpf(limpio);
      return {
        valido: ok,
        tipo,
        documentoLimpio: limpio,
        documentoFormateado: formateado,
        error: ok ? undefined : 'CPF inválido',
      };
    }

    if (tipo === 'cnpj') {
      const ok = this.validarCnpj(limpio);
      return {
        valido: ok,
        tipo,
        documentoLimpio: limpio,
        documentoFormateado: formateado,
        error: ok ? undefined : 'CNPJ inválido',
      };
    }

    return {
      valido: false,
      tipo: null,
      documentoLimpio: limpio,
      documentoFormateado: formateado,
      error: 'Ingresa un CPF (11 dígitos) o CNPJ (14 dígitos)',
    };
  }

  async consultarDocumento(valor: string): Promise<ResultadoDocumentoBr> {
    const base = this.validarLocal(valor);
    if (!base.valido || !base.tipo) return base;

    if (base.tipo === 'cpf') {
      return {
        ...base,
        situacion: 'Formato válido',
      };
    }

    try {
      const data = await firstValueFrom(
        this.http.get<Record<string, unknown>>(
          `https://brasilapi.com.br/api/cnpj/v1/${base.documentoLimpio}`
        )
      );

      return {
        ...base,
        razonSocial: typeof data['razao_social'] === 'string' ? data['razao_social'] : undefined,
        nombreFantasia:
          typeof data['nome_fantasia'] === 'string' && data['nome_fantasia'].trim()
            ? data['nome_fantasia']
            : undefined,
        situacion:
          typeof data['descricao_situacao_cadastral'] === 'string'
            ? data['descricao_situacao_cadastral']
            : 'Consultado',
      };
    } catch {
      return {
        ...base,
        situacion: 'Válido por dígito (sin consulta externa)',
      };
    }
  }
}