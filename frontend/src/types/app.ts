export type ThemeMode = "light" | "dark" | "system";
export type LanguageCode = "en" | "km";

export interface FlashMessage {
  category: string;
  message: string;
}

export interface UserSummary {
  id: number | null;
  username: string;
  full_name: string;
  email: string;
  roles: string[];
  avatar_url?: string;
}

export interface NotificationItem {
  id: number;
  kind?: string;
  title: string;
  message?: string;
  subtitle?: string;
  link?: string | null;
  url?: string | null;
  icon?: string;
  level?: string;
  time?: string;
  is_read?: boolean;
  unread?: boolean;
  created_at?: string | null;
}

export interface ThemeRuntime {
  theme_key?: string;
  preset?: string;
  animation_mode?: string;
  [key: string]: unknown;
}

export interface AuthBootstrapData {
  mode: "login" | "staff-login" | "register" | "forgot-password" | "reset-password" | "verify-code";
  role: "farmer" | "expert" | "admin";
  purpose?: string;
  email?: string;
  nextUrl?: string;
  csrfToken: string;
  submitUrl: string;
  googleLoginUrl?: string;
  passkeyOptionsUrl?: string;
  passkeyVerifyUrl?: string;
  sendOtpUrl?: string;
  resetPasswordApiUrl?: string;
  resendCodeUrl?: string;
  forgotPasswordUrl?: string;
  loginUrl?: string;
  staffLoginUrl?: string;
  registerUrl?: string;
  logoutUrl?: string;
  homeUrl?: string;
  values?: {
    email?: string;
    full_name?: string;
    verification_code?: string;
    code?: string;
  };
  errors?: Record<string, string[]>;
}

export interface ErrorBootstrapData {
  errorCode: number;
  errorTitle: string;
  errorMessage: string;
  requestPath: string;
  requestMethod: string;
  referrer?: string | null;
  requestId: string;
  timestamp: string;
  userLabel: string;
  homeUrl: string;
  validMethods?: string[];
}

export interface AppBootstrap<TData = Record<string, any>> {
  page: {
    id: string;
    scope: string;
  };
  path: string;
  serverOrigin?: string;
  locale: string;
  lang: LanguageCode;
  csrfToken: string;
  flashes: FlashMessage[];
  settings: {
    theme: ThemeMode;
  };
  urls: {
    home?: string;
    updateLanguageEn?: string;
    updateLanguageKm?: string;
    themeUpdate?: string;
    notifications?: string;
    logout?: string;
    logoLight?: string;
    logoDark?: string;
    [key: string]: string | undefined;
  };
  user: UserSummary;
  notifications: {
    items: NotificationItem[];
    unreadCount: number;
    link?: string | null;
  };
  themeRuntime?: ThemeRuntime | null;
  ui: Record<string, any>;
  data: TData;
}

export interface LoginActivityEntry {
  activity_id: string;
  ip_address?: string;
  location?: string;
  browser?: string;
  os?: string;
  platform?: string;
  device_type?: string;
  device_name?: string;
  device_label?: string;
  login_route?: string;
  route?: string;
  created_at?: string;
  last_seen_at?: string;
  is_current?: boolean;
  current?: boolean;
  is_active?: boolean;
  revoked?: boolean;
  revoked_at?: string | null;
}

export interface PasskeyItem {
  id: number;
  name: string;
  created_at?: string | null;
}
