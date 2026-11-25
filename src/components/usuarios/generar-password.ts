const GRUPOS_CARACTERES = [
  "abcdefghijkmnpqrstuvwxyz",
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "23456789",
  "!@#$%&*()-_=+",
] as const;

const TODOS_CARACTERES = GRUPOS_CARACTERES.join("");

function obtenerCrypto(): Crypto {
  const cripto = globalThis.crypto;
  if (!cripto) {
    throw new Error("El navegador no tiene criptografía segura disponible.");
  }
  return cripto;
}

function indiceAleatorio(maximo: number): number {
  const cripto = obtenerCrypto();
  const espacio = 0x1_0000_0000;
  const limite = espacio - (espacio % maximo);
  const valores = new Uint32Array(1);

  for (;;) {
    cripto.getRandomValues(valores);
    const valor = valores[0];
    if (valor !== undefined && valor < limite) {
      return valor % maximo;
    }
  }
}

function caracterAleatorio(alfabeto: string): string {
  return alfabeto.charAt(indiceAleatorio(alfabeto.length));
}

export function generarPasswordSegura(longitud = 16): string {
  if (!Number.isInteger(longitud) || longitud < 12 || longitud > 128) {
    throw new Error("La longitud de la contraseña debe estar entre 12 y 128.");
  }

  const caracteres = GRUPOS_CARACTERES.map((grupo) => caracterAleatorio(grupo));

  while (caracteres.length < longitud) {
    caracteres.push(caracterAleatorio(TODOS_CARACTERES));
  }

  for (let indice = caracteres.length - 1; indice > 0; indice -= 1) {
    const destino = indiceAleatorio(indice + 1);
    const actual = caracteres[indice];
    const elegido = caracteres[destino];
    if (actual === undefined || elegido === undefined) continue;
    caracteres[indice] = elegido;
    caracteres[destino] = actual;
  }

  return caracteres.join("");
}
