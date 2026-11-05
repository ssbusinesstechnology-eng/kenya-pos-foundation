<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Reports use read-only security-invoker PostgreSQL RPCs through authenticated server functions; existing table RLS remains authoritative and no tenant ID is accepted.
- Reporting periods use shared Nairobi boundaries and URL filters; monetary aggregation stays in PostgreSQL numeric and returns decimal strings to prevent browser rounding drift.
- Report detail tables are paginated in the database; historical product figures use sale-item snapshots, while inventory fields are explicitly current.
