import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
} from 'axios';
import { toast } from 'sonner';
import { clearAuthStorage, getStoredToken } from '@/utils/auth-storage';

const api_url = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3142';

const instance = axios.create({
  baseURL: `${api_url}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

instance.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Default JSON Content-Type breaks multipart: browser must set boundary.
  if (config.data instanceof FormData && config.headers) {
    if (config.headers instanceof AxiosHeaders) {
      config.headers.delete('Content-Type');
    } else {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
  }
  return config;
});

const PUBLIC_PATH_PREFIXES = ['/solicitacao', '/login'];

type ApiErrorBody = {
  error?: string;
  message?: string;
  mensagem?: string;
};

function isPublicAppPath() {
  const pathname = window.location.pathname;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function extractApiMessage(data: ApiErrorBody | undefined): string | undefined {
  if (!data) return undefined;
  for (const key of ['error', 'message', 'mensagem'] as const) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function capitalizeMessage(message: string): string {
  if (!message) return message;
  return message.charAt(0).toUpperCase() + message.slice(1);
}

function fallbackMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Dados inválidos. Verifique as informações e tente novamente.';
    case 401:
      return 'Não autorizado. Faça login novamente.';
    case 403:
      return 'Você não tem permissão para realizar esta ação.';
    case 404:
      return 'Recurso não encontrado.';
    case 409:
      return 'Conflito com o estado atual. Atualize a página e tente novamente.';
    case 422:
      return 'Não foi possível processar os dados enviados.';
    case 429:
      return 'Muitas tentativas. Aguarde um momento e tente novamente.';
    case 502:
      return 'Serviço externo indisponível no momento. Tente novamente em instantes.';
    case 503:
      return 'Serviço temporariamente indisponível. Tente novamente em instantes.';
    case 504:
      return 'O servidor demorou para responder. Tente novamente.';
    case 500:
      return 'Erro interno do servidor. Se o problema persistir, contate o suporte.';
    default:
      return `Erro inesperado (código ${status}). Verifique a conexão e tente novamente.`;
  }
}

function resolveApiErrorMessage(
  status: number,
  apiMessage: string | undefined,
): string {
  if (apiMessage) {
    return capitalizeMessage(apiMessage);
  }
  return fallbackMessageForStatus(status);
}

function resolveNetworkErrorMessage(error: AxiosError): string {
  if (error.code === 'ECONNABORTED') {
    return 'A requisição demorou demais. Tente novamente.';
  }
  if (error.message?.toLowerCase().includes('network error')) {
    return 'Falha de rede. Verifique sua conexão com a internet.';
  }
  return 'Não foi possível conectar ao servidor. Verifique se o serviço está no ar.';
}

function applyErrorInterceptor(api: AxiosInstance) {
  api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorBody>) => {
      let message: string;
      let status = 500;
      let skipToast = Boolean(error.config?.skipErrorToast);
      if (error.response) {
        status = error.response.status;
        const apiMessage = extractApiMessage(error.response.data);
        if (
          status === 401 &&
          apiMessage !== 'Credenciais inválidas'
        ) {
          clearAuthStorage();
          if (isPublicAppPath()) {
            // Public pages (e.g. /solicitacao) must stay usable with a stale token.
            message = '';
            skipToast = true;
          } else {
            message = resolveApiErrorMessage(
              status,
              apiMessage || 'Sua sessão expirou, faça login novamente.',
            );
            setTimeout(() => {
              window.location.href = '/login';
            }, 1500);
          }
        } else {
          message = resolveApiErrorMessage(status, apiMessage);
        }
      } else {
        message = resolveNetworkErrorMessage(error);
      }
      if (!skipToast && message) {
        toast.error(message);
      }
      return Promise.reject({ message, status });
    },
  );
}

applyErrorInterceptor(instance);

export default instance;
