import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Se true, o interceptor não exibe toast em erro (estado esperado na tela). */
    skipErrorToast?: boolean;
  }
}
