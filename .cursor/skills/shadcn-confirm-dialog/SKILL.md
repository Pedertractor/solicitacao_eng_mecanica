---
name: shadcn-confirm-dialog
description: >-
  Use the dialog from shadcn when a confirmation is required, instead of using
  the navigator default (window.confirm / confirm / alert). Prefer shadcn
  AlertDialog for yes/no destructive or irreversible actions in the React
  frontend. Use when adding confirmations, replacing confirm(), or building
  delete/reset/submit-review UX.
---

# Shadcn confirmation dialog

## Rule (verbatim)

use the dialog from shadcn when a confirmation is required, instead of using the navigator default

## Forbidden

Do **not** use:

- `window.confirm(...)`
- `confirm(...)`
- `window.alert(...)` / `alert(...)` for user decisions
- Any other browser-native prompt for confirmation

## Required component

For confirmations, use shadcn **AlertDialog** from:

`@/components/ui/alert-dialog`

| Need | Component |
|------|-----------|
| Yes/no confirmation (delete, reset, homologate, purge, sync warn) | `AlertDialog` |
| Form / multi-field modal / progress overlay | `Dialog` (`@/components/ui/dialog`) — not a confirmation substitute |

If `alert-dialog` is missing, add the shadcn Alert Dialog component before inventing a custom modal.

## Pattern (controlled open state)

Match existing pages (`EditUserModal`, `P5CyclesPage`, `P5CycleDetailPage`):

1. State: `const [confirmOpen, setConfirmOpen] = useState(false)`
2. Trigger button: `onClick={() => setConfirmOpen(true)}` (no native `confirm`)
3. Render `AlertDialog` with `open` + `onOpenChange`
4. Cancel: `AlertDialogCancel` labeled `Cancelar`
5. Confirm: `AlertDialogAction` runs the mutation; `event.preventDefault()` when you must keep the dialog open while pending
6. Disable actions while `mutation.isPending`; show loading label when useful
7. Destructive confirms: add destructive button classes on `AlertDialogAction`

See [confirm-template.md](confirm-template.md).

## Copy

- UI strings in Portuguese (project convention)
- Title = short question; description = consequence
- Prefer clear action labels (`Confirmar`, `Apagar`, `Homologar`) over generic OK

## Checklist

```
Confirmation UX:
- [ ] No confirm()/alert() in changed files
- [ ] Uses AlertDialog from @/components/ui/alert-dialog
- [ ] Controlled open state on the trigger path
- [ ] Cancel + confirm actions; pending disabled when async
- [ ] Destructive styling when the action is destructive
```

## When replacing existing `confirm()`

1. Grep the frontend for `confirm(` / `window.confirm`
2. Replace each call with AlertDialog open-state + action handler
3. Keep the same Portuguese intent in title/description
