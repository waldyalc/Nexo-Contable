# docs/migracion-sqlite.md — Migración SQLite → Supabase

Guía operativa para llevar una base local de **Nexo Contable** (SQLite) a Supabase
respetando el modelo multi-empresa, la partida doble y la política de **cero
correos automáticos** de la Fase 1.

> ⚠️ **Repositorio público.** Nunca copies correos reales, RNC reales ni nombres
> de empresas clientes en archivos versionados. Todos los ejemplos de esta guía
> usan datos sintéticos (`@ejemplo.test`, `Empresa Demo SRL`, RNC `101123456`).
> La base de origen y el JSON de usuarios viven en `work/`, que está ignorado
> por git (`.gitignore` + `src/lib/__tests__/datos-privados.test.ts`).

---

## 1. Requisitos

1. Node.js 22.5 o superior (el script usa `node:sqlite` nativo, sin módulos
   nativos adicionales).
2. Dependencias instaladas: `pnpm install`.
3. `.env.local` en la raíz con las credenciales del proyecto **de desarrollo**:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROJECT-REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   ```

   La `service_role` solo se usa en `scripts/`; **jamás** la importes desde
   `src/app/` ni `src/components/`.

4. Migraciones aplicadas en Supabase (núcleo, motor contable, documentos y
   bancos/inventario). Este script no ejecuta migraciones.

---

## 2. Archivos locales (ignorados por git)

```text
work/
├── nexo.sqlite                 # base SQLite de origen (solo lectura)
└── usuarios-iniciales.json     # usuarios a pre-aprovisionar
```

### Ejemplo de `work/usuarios-iniciales.json` (solo datos sintéticos)

```json
{
  "usuarios": [
    {
      "email": "admin@ejemplo.test",
      "nombre": "Administrador Demo",
      "rol_global": "admin_global",
      "empresas": [
        {
          "rnc_o_nombre": "101123456",
          "rol": "admin_empresa",
          "es_principal": true
        }
      ]
    },
    {
      "email": "contador@ejemplo.test",
      "nombre": "Contador Demo",
      "rol_global": "usuario",
      "empresas": [
        {
          "rnc_o_nombre": "Empresa Demo SRL",
          "rol": "contador",
          "es_principal": true
        }
      ]
    },
    {
      "email": "auxiliar@ejemplo.test",
      "nombre": "Auxiliar Demo",
      "rol_global": "usuario",
      "empresas": [
        {
          "rnc_o_nombre": "101123456",
          "rol": "auxiliar"
        }
      ]
    }
  ]
}
```

Reglas de validación (Zod, en `scripts/lib/migracion-utils.ts`):

* `rol_global`: `admin_global` | `usuario`.
* `rol` por empresa: `admin_empresa` | `contador` | `auxiliar` | `cliente`.
* `rnc_o_nombre` se compara contra el RNC normalizado o el nombre comercial /
  razón social de las empresas migradas.
* No se permiten correos duplicados (sin distinguir mayúsculas).
* Solo se admite **una** empresa principal por usuario.

---

## 3. Paso 1 — Ensayo en seco (`--dry-run`)

No requiere Supabase ni escribe nada. Abre el SQLite en modo `readOnly`,
inspecciona `sqlite_master` (tolera tablas opcionales), valida la partida doble de
todos los asientos contabilizados y muestra el resumen por tabla.

```bash
pnpm exec tsx scripts/migrar-sqlite-a-supabase.ts \
  --sqlite work/nexo.sqlite \
  --usuarios work/usuarios-iniciales.json \
  --dry-run
```

Salida esperada (resumida):

```text
Modo: dry-run (sin escrituras)
SQLite: /ruta/work/nexo.sqlite

Resumen por tabla (dry-run)
  perfiles (config)            3
  empresas                     1
  empresa_usuarios             3
  periodos_contables           2
  cuentas                    347
  terceros                    48
  asientos                   120
  asiento_lineas             360
  documentos_financieros      80
  documento_pagos             35
  ...

Cuadre validado: todos los asientos contabilizados cumplen partida doble.
```

Si algún asiento está descuadrado, el script aborta **antes de escribir** con el
número de asiento y la diferencia exacta en pesos.

---

## 4. Paso 2 — Migración real

Primero confirma que estás apuntando al proyecto correcto (`.env.local` de
desarrollo, nunca producción sin autorización del Orquestador):

```bash
pnpm exec tsx scripts/migrar-sqlite-a-supabase.ts \
  --sqlite work/nexo.sqlite \
  --usuarios work/usuarios-iniciales.json
```

Qué hace, en este orden:

1. **Usuarios y perfiles:** busca el correo en `auth.users`; si no existe, crea
   el usuario con `email_confirm: true` y una contraseña aleatoria de 24 bytes
   (nunca se muestra ni se envía). Inserta `public.perfiles` con
   `debe_definir_password = true`. Si el perfil ya existe, **respeta su estado**
   (por ejemplo, un usuario que ya definió su contraseña).
2. **Empresas** por RNC normalizado (o nombre si no hay RNC).
3. **Asignaciones** `empresa_usuarios` (una principal por usuario).
4. Periodos contables, catálogo de cuentas en orden padre → hijo, terceros,
   métodos de pago, secuencias NCF/e-CF.
5. **Asientos + líneas** (partida doble validada al centavo antes de insertar).
6. **Documentos financieros + pagos**, bancos, inventario, activos fijos y
   empleados.

### Idempotencia

* Cada fila recibe un UUID determinista (SHA-256 en formato UUID v5) derivado de
  su clave natural: `rnc_normalizado`, `(empresa_id, codigo)`,
  `(empresa_id, numero)`, `(empresa_id, sku)`, etc.
* Las escrituras usan `upsert(..., { ignoreDuplicates: true })` con el id
  determinista, y antes se leen las filas existentes para reutilizar sus ids.
* Re-ejecutar el script **no duplica** filas ni altera perfiles ya creados.

### Tablas opcionales

El lector inspecciona `sqlite_master` y busca nombres alternativos
(`cuentas`/`catalogo_cuentas`, `documentos_financieros`/`documentos`/`facturas`,
`pagos`/`documento_pagos`, etc.). Las filas incompletas (sin empresa, sin cuenta o
sin tercero) se omiten y se reportan como **advertencias** al final.

---

## 5. Paso 3 — Verificación del cuadre

```bash
pnpm exec tsx scripts/verificar-cuadre.ts \
  --sqlite work/nexo.sqlite \
  --salida work/reporte-cuadre.md
```

Controles que ejecuta:

* Conteo de filas por tabla y por empresa (comparado con SQLite si se pasa
  `--sqlite`).
* Cuadre global y por empresa: `SUM(debito) = SUM(credito)` en todos los
  asientos `posted`, `reversed` y `reversal`.
* Asientos contabilizados con menos de 2 líneas.
* Líneas en cuentas de agrupación, con subcuentas o inactivas.
* Líneas cuya `empresa_id` no coincide con la del asiento.
* Documentos contabilizados sin asiento y componentes que no suman el total.
* Pagos activos que exceden el total del documento.
* Inventario con `cantidad_disponible < 0` o `valor_total < 0`.

Sale con **código 0** si todo cuadra al centavo y **código 1** ante cualquier
descuadre. El reporte Markdown se escribe en la ruta de `--salida` (por defecto
no se escribe archivo).

### Consultas manuales

`docs/pruebas/cuadre.sql` contiene 18 consultas listas para el SQL Editor de
Supabase o `psql` (cuadre por asiento/empresa, secuencias NCF por agotarse,
usuarios sin perfil, empresas sin periodo abierto, reversos huérfanos, etc.).

---

## 6. Qué hacer ante un error

| Mensaje | Acción |
| --- | --- |
| `El asiento JE-... no cumple partida doble` | Corregir el asiento en SQLite de origen o excluirlo; no editar la migración aplicada. |
| `referencia una cuenta no migrada` | Verificar que la cuenta exista en `cuentas` y con `empresa_id` correcto. |
| `Documento ... sin tercero migrado` | El tercero fue omitido por datos incompletos; revisar la advertencia previa. |
| `Fallo al escribir ... duplicate key` | Ya existe una fila con la misma clave natural y otro id; revisar el registro manual en Supabase antes de reintentar. |
| `No existe .env.local` | Crear `.env.local` desde `.env.example` con las credenciales de desarrollo. |

Nunca uses `--no-verify`, `git push --force` ni ejecutes `supabase db push` sin
orden expresa del Orquestador.
