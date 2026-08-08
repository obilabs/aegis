# Aegis Web - Feature Status

Current status of features in Aegis-web.

## Completed Features

### Marketing Site
- [x] Landing page
- [x] Features overview
- [x] Pricing information
- [x] Privacy policy
- [x] Terms of service
- [x] Usage insights page

### Donations (Stripe)
- [x] One-time donations
- [x] Recurring monthly donations
- [x] Preset amounts ($5, $10, $25, $50)
- [x] Custom amount input
- [x] Stripe Checkout integration
- [x] Success/cancel pages
- [x] Credits page (public supporters list)
- [x] Anonymous donation option
- [x] Custom display names

### Waitlist
- [x] Email signup form
- [x] Company name collection
- [x] Expected users (team size)
- [x] Use case description
- [x] Queue position display

### AI Support Chat
- [x] Gemini integration (gemini-1.5-flash)
- [x] Conversation history
- [x] Rate limiting (20 messages/hour)
- [x] Auto title generation
- [x] User authentication required

### Telemetry API
- [x] POST /api/instances/heartbeat
- [x] POST /api/instances/validate
- [x] Anonymous metrics collection
- [x] License key validation

### Authentication
- [x] better-auth integration
- [x] Email/password login
- [x] Session management
- [x] User portal (authenticated area)

---

## Coming Soon

### Cloud Hosting
- [ ] Automated VPS provisioning (Vultr)
- [ ] DNS record management (Cloudflare)
- [ ] SSL certificate automation
- [ ] Instance dashboard
- [ ] Billing via Stripe subscriptions

### Enhanced Features
- [ ] Google OAuth login (Workspace accounts only)
- [ ] Email notifications (Resend)
- [ ] Admin dashboard for support
- [ ] Donation management dashboard

---

## Database Tables

Current schema (see `database/migrations/`):

| Table | Purpose |
|-------|---------|
| `user` | better-auth user accounts |
| `session` | User sessions |
| `account` | OAuth account links |
| `instance_heartbeats` | Telemetry data |
| `aggregated_metrics` | Public usage stats |
| `registered_instances` | User-linked instances |
| `cloud_waitlist` | Waitlist signups |
| `donations` | Donation records |
| `support_conversations` | Chat threads |
| `support_messages` | Individual messages |

---

## Environment Dependencies

| Feature | Required Environment Variable |
|---------|------------------------------|
| Database | `DATABASE_URL` |
| Auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| Donations | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| AI Chat | `GOOGLE_AI_API_KEY` |
| License | `LICENSE_SECRET` |
