import { defineMiddleware } from 'astro:middleware';
import { isValidSession, SESSION_COOKIE } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isAdminArea =
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path.startsWith('/api/admin/');
  const isLogin = path === '/admin/login' || path === '/admin/login/';

  if (isAdminArea && !isLogin) {
    const token = context.cookies.get(SESSION_COOKIE)?.value;
    if (!(await isValidSession(token))) {
      if (path.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Chưa đăng nhập' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/admin/login/');
    }
  }

  const response = await next();

  if (isAdminArea) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
});