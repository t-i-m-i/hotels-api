# GitHub Actions

## manual workflow_dispatch

To trigger manually:

- GitHub UI: Go to Actions tab → select workflow → "Run workflow"
- GitHub CLI: `gh workflow run lint-and-test.yml`

## 1. Triggering on push / pull request

The `on:` block is the only thing that changes. Common setups:

```yaml
on:
  # Run when commits land on main (direct push OR merged PR)
  push:
    branches: [main]

  # Run on every PR targeting main, on each new commit to that PR
  pull_request:
    branches: [main]

  # Keep the manual button too
  workflow_dispatch:
```

Notes:

- **`push` + `pull_request` together is the normal combo.** `pull_request` gives you the check _before_ merge; `push: [main]` re-verifies the merged result (and covers direct pushes). A merged PR fires the `push` event on main, not a special "merge" event.
- **Don't gate `pull_request` on the source branch name** — filter by the _target_ (`branches: [main]` means "PRs whose base is main").
- Optional: skip runs when only irrelevant files change:
  ```yaml
  push:
    branches: [main]
    paths-ignore: ['**.md', 'docs/**']
  ```
- If you later add path filters, know that a _required_ check which is skipped by path filtering can block merges — there's a workaround (a separate "always passes" job) but you don't need it yet.

## 2. "Block merge when the job fails" — branch protection

The workflow itself has no say in whether a merge is allowed. A red X on a PR is just information until you add a **branch protection rule** (or **ruleset**) that makes the check _required_.

**Where:** GitHub repo → **Settings** → **Branches** → **Add branch ruleset** (or the older "Add rule" under "Branch protection rules").

**What to set:**

| Setting                                          | Value           | Effect                                                                                                                           |
| ------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Target branch                                    | `main`          | Rule applies to PRs merging into main                                                                                            |
| Require a pull request before merging            | on              | No direct pushes to main; everything goes through a PR                                                                           |
| Require status checks to pass                    | on              | The gate                                                                                                                         |
| → select the check                               | `lint-and-test` | This is the **job name** (`jobs.lint-and-test`), which appears in the list only after the workflow has run at least once on a PR |
| Require branches to be up to date before merging | optional        | Forces PR to be rebased/merged with latest main before merge — catches "passes alone, breaks combined"                           |

Once that's on, the PR's **Merge** button is disabled until `lint-and-test` reports success. A failing run = merge blocked. There's no "auto-reject/close the PR" option — it just stays unmergeable until fixed or force-merged by an admin (if you allow that).

**Gotchas to note:**

- The check name in the required-checks list is the **job** name, not the workflow name. If you rename the job later, the protection rule silently stops matching (treats it as "never reported") and you must re-select it.
- The check only shows up in the picker after it has actually run on a PR once — so push the workflow, open a throwaway PR, let it run, then configure protection.
- `workflow_dispatch`-only workflows can't be required (they never run on a PR), so you'd need the `pull_request` trigger first.
