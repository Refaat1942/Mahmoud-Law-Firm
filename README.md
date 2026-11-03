# Mahmoud Law Firm — office management

Next.js 15 (App Router) + PostgreSQL/Prisma. Arabic/English with RTL. Built for a single UAE law office.

Default login after seed: `admin@lawoffice.ae` / `Admin@12345` — change this immediately on any live server.

## Local development

```bash
npm install
cp .env.example .env   # AUTH_SECRET must be a long random string
npm run db:dev         # embedded Postgres on port 5433
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Production on an existing VPS (`lawfirm.fratelanza.com`)

This stack is isolated from other sites on the same machine:

- Docker Compose project name is `mahmoud-law-firm` (own network, volumes, containers).
- Postgres/Redis/MinIO are **not** published on host ports.
- The app listens only on `127.0.0.1:3017`.
- nginx/Caddy gets a **new** `server_name` for this subdomain only. Existing vhosts are not replaced.

DNS: `lawfirm.fratelanza.com` → A record to the VPS (`187.124.15.14`), Cloudflare **DNS only**.

On the VPS (as root):

```bash
curl -fsSL https://raw.githubusercontent.com/Refaat1942/Mahmoud-Law-Firm/main/deploy/vps.sh | bash
```

Or clone and run:

```bash
git clone https://github.com/Refaat1942/Mahmoud-Law-Firm.git /opt/mahmoud-law-firm
sudo bash /opt/mahmoud-law-firm/deploy/vps.sh
```

Updates later: `sudo bash /opt/mahmoud-law-firm/deploy/vps.sh` (pulls `main` and rebuilds this stack only).

If port `3017` is already used: `LAW_FIRM_PORT=3021 sudo -E bash deploy/vps.sh` and edit the `proxy_pass` port in the nginx file to match.
