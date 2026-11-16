import { defineMiddleware } from 'astro:middleware';
import { getSessionUser, SESSION_COOKIE } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isAdminArea =
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path.startsWith('/api/admin/');
  const isLogin = path === '/admin/login' || path === '/admin/login/';
  const isOwnerOnly = path === '/admin/nhan-vien' || path.startsWith('/admin/nhan-vien/');

  if (isAdminArea && !isLogin) {
    const token = context.cookies.get(SESSION_COOKIE)?.value;
    const user = await getSessionUser(token);
    if (!user) {
      if (path.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Chưa đăng nhập' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/admin/login/');
    }

    (context.locals as any).adminUser = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    };

    if (isOwnerOnly && user.role !== 'owner') {
      return context.redirect('/admin/');
    }
  }

  const response = await next();

  if (isAdminArea) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
});