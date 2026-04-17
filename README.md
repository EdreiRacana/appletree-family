# 🍎 AppleTree Family

> **Una red social familiar y árbol genealógico interactivo.** Conecta generaciones, preserva memorias, comparte logros.

[![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?logo=railway)](https://railway.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)

---

## 🌳 ¿Qué es AppleTree Family?

AppleTree Family es una plataforma donde cada familia tiene su propio **árbol de manzanas interactivo**, donde cada miembro es representado por un nodo manzana (rojo = línea directa, verde = familia extendida, rosa = bebés).

### Funcionalidades principales
- 🍎 **Árbol genealógico interactivo** — scrollable, zoomable, con generaciones infinitas
- 💬 **Chat privado en tiempo real** — entre miembros de la familia  
- 📸 **Álbumes de fotos** — almacenados en Backblaze B2 + CDN gratis
- 🎉 **Family Buzz** — feed de actividad con cumpleaños, logros, saludos
- 🔒 **Privacidad escalonada** — Núcleo / Extendido / Público
- 🌍 **Búsqueda de ancestros** — entre árboles marcados como legado público

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Hosting | Costo |
|------|-----------|---------|-------|
| Frontend | Next.js 14 (App Router) | Vercel | $0 |
| Backend API | Node.js + Express | Railway | $0-5 |
| Base de Datos | Supabase (Postgres + RLS + Realtime) | Supabase | $0 |
| Auth | Supabase Auth | Supabase | $0 |
| Fotos de Perfil | Cloudinary (WebP auto) | Cloudinary | $0 |
| Álbumes | Backblaze B2 + Cloudflare CDN | B2 + CF | $0 |

**Costo total MVP: $0/mes** 🚀

---

## 📁 Estructura del Proyecto

```
appletree-family/
├── apps/
│   └── web/              ← Next.js 14 (→ Vercel)
├── backend/              ← Node.js API (→ Railway)
├── supabase/
│   ├── migrations/       ← SQL schemas versionados
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── .env.example          ← Variables de entorno (sin valores)
├── .gitignore
└── README.md
```

---

## 🚀 Guía de Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/Edreione/appletree-family.git
cd appletree-family
```

### 2. Configurar variables de entorno
```bash
cp .env.example apps/web/.env.local
# Edita .env.local con tus credenciales reales
```

### 3. Aplicar el esquema en Supabase
1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. SQL Editor → New Query
3. Pega el contenido de `supabase/migrations/001_initial_schema.sql`
4. Run ✅

### 4. Instalar dependencias y correr en local
```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

---

## 🔐 Variables de Entorno

Ver `.env.example` para la lista completa. Las variables principales son:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
B2_BUCKET_NAME=
B2_ENDPOINT=
```

---

## 🗺️ Roadmap

- [x] Esquema SQL + RLS en Supabase
- [ ] Auth (email + Google OAuth)
- [ ] Canvas interactivo del árbol
- [ ] Nodos AppleNode + HoverMenu
- [ ] Live Chat (Supabase Realtime)
- [ ] Activity Feed "Family Buzz"
- [ ] Álbumes de fotos (B2 + CDN)
- [ ] Solicitudes de acceso cruzado entre familias

---

## 👨‍💻 Autor

**Edrei Elias** — [@Edreione](https://github.com/Edreione)

---

*Construido con ❤️ para conectar familias a través de generaciones.*
