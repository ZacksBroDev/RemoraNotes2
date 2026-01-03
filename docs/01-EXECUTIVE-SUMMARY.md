# RemoraNotes - Executive Summary

## 10-Bullet Overview

1. **What**: Mobile-first relationship reminder SaaS for business follow-ups and personal relationship management (birthdays, anniversaries, ADHD-friendly memory support).

2. **Who**: Solo professionals, freelancers, sales people, and individuals who struggle to maintain consistent contact with important relationships.

3. **Core Problem**: People forget to follow up with clients, leads, friends, and family. Missed touchpoints damage relationships and cost business.

4. **Solution**: Automated reminder system with configurable intervals (30/60/90/365 days), priority-scored daily queues, and morning email digests that tell you exactly who to contact today.

5. **Key Differentiator**: Business/Personal/Both mode toggle - same engine, different presets. Not a heavy CRM, not a generic reminder app. Purpose-built for relationship nurturing.

6. **Tech Stack**: MERN (MongoDB, Express, React/Vite, Node.js) on AWS with Google OAuth, People API, Calendar API, and SES for email.

7. **Security-First**: Field-level encryption (AWS KMS), encrypted OAuth tokens, per-user data boundaries, privacy-first calendar storage (no event titles by default), hard delete on account removal.

8. **Monetization Path**: FREE tier (50 contacts, 10/day queue cap) → PRO tier (unlimited contacts, 25/day queue, 90-day calendar window, CSV export). Billing deferred but plan model built-in.

9. **MVP Timeline**: 2 weeks to functional prototype with Google auth, contact management, basic reminders, and email digests. 6 weeks to production-ready v1.

10. **Success Metrics**: User completes onboarding, imports contacts, receives first digest, marks at least one reminder complete within 7 days.

---

## Value Proposition Matrix

| User Type         | Pain Point                        | RemoraNotes Solution                              |
| ----------------- | --------------------------------- | ------------------------------------------------- |
| Freelancer        | Forgets to follow up with leads   | 30/60/90 day follow-up reminders                  |
| Sales Rep         | Loses track of client touchpoints | Last contacted tracking + conversation logs       |
| ADHD Individual   | Forgets birthdays/anniversaries   | Auto-generated birthday reminders from Google     |
| Busy Professional | Information overload              | Capped, prioritized daily queue                   |
| Privacy-Conscious | Doesn't want data harvested       | Minimal PII, encrypted storage, user data control |

---

## Non-Goals (Explicit)

- ❌ Full CRM functionality (deal tracking, pipelines, forecasting)
- ❌ Team/organization accounts (v1 is single-user only)
- ❌ Push notifications or native mobile apps
- ❌ SMS notifications
- ❌ Calendar event creation (read-only import)
- ❌ AI-generated message suggestions
- ❌ Social media integrations
