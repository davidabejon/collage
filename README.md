# Collage

Libros de recuerdos con fotos polaroid y post-its. Frontend React + Vite + Tailwind, backend FastAPI + SQLite.

Los libros pueden crearse con otro usuario registrado o compartirse más tarde desde los ajustes del libro, indicando su nombre de usuario. Los colaboradores pueden editar, añadir contenido y compartir el libro con más usuarios; solo el dueño original puede eliminarlo. El acceso se concede inmediatamente, sin invitación pendiente.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env   # y cambia SECRET_KEY
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Tests: `.\.venv\Scripts\python -m pytest`

## Frontend

```powershell
npm install
npm run dev            # añade -- --host para probar desde el móvil en la misma red
```

Vite redirige `/api` a `http://localhost:8000`, así que frontend y API comparten origen y la cookie de sesión (httpOnly) funciona sin CORS.

## Producción

- Define `SECRET_KEY` y `COOKIE_SECURE=true` (el servidor no arranca con la clave por defecto si `COOKIE_SECURE=true`).
- Sirve `dist/` y `/api` desde el mismo dominio (p. ej. con un proxy inverso).
