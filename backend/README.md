# THAT Clinic MySQL Bridge Backend

This backend persists app state from localStorage into MySQL.

## 1) Prepare MySQL

Run `schema.sql` in MySQL Workbench/phpMyAdmin:

```sql
SOURCE /path/to/backend/schema.sql;
```

Or copy/paste content of `schema.sql` manually.

## 2) Configure environment

Create `.env` from `.env.example` and update DB credentials:

```bash
cp .env.example .env
```

To temporarily run backend without MySQL connection (for maintenance/drop database), set:

```env
MYSQL_DISABLED=true
```

## 3) Install and start

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`.

## 4) Verify connection

Open:

- `http://localhost:3000/api/health`

Expected:

```json
{ "ok": true, "database": "connected" }
```

## API used by frontend bridge

- `GET /api/state?keys=a,b,c`
- `PUT /api/state/:key` with body `{ "value": <any-json> }`
- `DELETE /api/state/:key`
