# Email authentication setup

## Supabase registration fix

Apply the migrations in `supabase/migrations/` in filename order. The
`20261112_001_app_user_created_at.sql` migration is safe to rerun: it adds and
backfills `app_user.createdAt`, makes it required, and reloads the PostgREST
schema cache. Registration returns a server error when this column is missing
from the deployed Supabase schema.

## Vercel password-reset email

Password-reset links are sent by the server through SMTP. Add these variables
to the Vercel **Production** environment, then redeploy:

```text
NEXT_PUBLIC_APP_URL=https://your-deployed-domain.example
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASSWORD=your-google-app-password-without-spaces
SMTP_FROM=Hope, Inc. ERP <your-account@gmail.com>
```

Use a provider's SMTP credentials or a transactional-mail provider. Do not put
real credentials in `.env.example`, source files, commits, or pull requests.
`SMTP_FROM` must be an address accepted by the provider. The application keeps
the reset response generic so it does not disclose whether an email exists.

After changing Vercel variables, trigger a new deployment; existing serverless
instances do not receive updated environment variables automatically.
