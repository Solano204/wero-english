/**
 * Caché con tope: al pasar de `max` entradas se va la que lleva más tiempo sin usarse. La misma forma que un `Map`
 * (get, set, has, delete, clear, size) para cambiarla sin tocar a quien la usa.
 *
 * Usa el orden de inserción del `Map`: leer una entrada la vuelve a poner al final.
 */
export class Lru<K, V> {
  private readonly datos = new Map<K, V>();

  constructor(private readonly max: number) {}

  get(clave: K): V | undefined {
    if (!this.datos.has(clave)) return undefined;
    const valor = this.datos.get(clave) as V;
    this.datos.delete(clave);
    this.datos.set(clave, valor);
    return valor;
  }

  set(clave: K, valor: V): this {
    this.datos.delete(clave);
    this.datos.set(clave, valor);
    while (this.datos.size > this.max) {
      const vieja = this.datos.keys().next().value as K;
      this.datos.delete(vieja);
    }
    return this;
  }

  has(clave: K): boolean {
    return this.datos.has(clave);
  }

  delete(clave: K): boolean {
    return this.datos.delete(clave);
  }

  clear(): void {
    this.datos.clear();
  }

  get size(): number {
    return this.datos.size;
  }
}
