export interface World {
  id: string;
  nombre: string;
  descripcion: string;
  topics: string[];
  orden: number;
  color?: string;
  es_modo_aparte?: boolean;
  total_entradas: number;
  total_packs: number;
  tiene_lenguaje_fuerte: boolean;
}

export interface Pack {
  id: string;
  mundo: string;
  nombre: string;
  descripcion: string;
  orden: number;
  gratis: boolean;
  empaquetado: boolean;
  pack_ids_origen: string[];
  total_entradas: number;
  nivel_1: number;
  nivel_2: number;
  nivel_3: number;
  vulgaridad_0: number;
  vulgaridad_1: number;
  vulgaridad_2: number;
  archivos_audio: number;
  archivos_imagen: number;
  peso_mb: number;
  url: string | null;
}

export interface PacksFile {
  version: number;
  generado: string;
  total_entradas: number;
  total_packs: number;
  mundos: World[];
  packs: Pack[];
}
