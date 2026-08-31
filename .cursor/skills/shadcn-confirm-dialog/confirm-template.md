# AlertDialog confirmation template

Import:

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

## Controlled confirmation

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);

// Trigger
<Button type='button' onClick={() => setConfirmOpen(true)}>
  Ação
</Button>

<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirmar esta ação?</AlertDialogTitle>
      <AlertDialogDescription>
        Descreva o impacto. Esta ação pode ser irreversível.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel type='button' disabled={mutation.isPending}>
        Cancelar
      </AlertDialogCancel>
      <AlertDialogAction
        type='button'
        disabled={mutation.isPending}
        onClick={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        Confirmar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Close the dialog in `onSuccess` (or `onSettled`) of the mutation when using `preventDefault`, e.g. `setConfirmOpen(false)`.

## Destructive variant

```tsx
<AlertDialogAction
  type='button'
  disabled={mutation.isPending}
  onClick={(event) => {
    event.preventDefault();
    mutation.mutate();
  }}
  className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
>
  {mutation.isPending ? 'Processando…' : 'Confirmar'}
</AlertDialogAction>
```

## Anti-pattern

```tsx
// BAD — navigator / browser default
if (confirm('Apagar registros?')) {
  mutation.mutate();
}

// GOOD — shadcn AlertDialog (see above)
```

## Reference in this repo

- `front-end/src/pages/Usuarios/EditUserModal.tsx` — reset password confirm
- `front-end/src/pages/P5/P5CyclesPage.tsx` — review / open cycle confirms
- `front-end/src/pages/P5/P5ConfigPage.tsx` — purge / sync confirms
- `front-end/src/pages/P5/P5CycleDetailPage.tsx` — review / open / homologate / lock confirms
