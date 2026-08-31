import { z } from 'zod';
import { UNIT } from '@/types/auth';

export const loginFormSchema = z.object({
  cardNumber: z.string().min(1, 'Cartão é obrigatório'),
  unit: z.enum(UNIT, { message: 'Unidade é obrigatória' }),
  password: z.string().min(1, 'Senha deve ter no mínimo 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;

export const changePasswordFormSchema = z
  .object({
    newPassword: z.string().min(1, 'Senha deve ter no mínimo 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordFormSchema>;
