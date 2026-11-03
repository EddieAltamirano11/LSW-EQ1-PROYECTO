import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import config from '../config/config.js';

const router = Router();
const assetsDirectory = fileURLToPath(new URL('../../public/login/', import.meta.url));
const templatePath = new URL('../../public/login/index.html', import.meta.url);
const attributeEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

router.get('/login', async (req, res, next) => {
  try {
    const template = await readFile(templatePath, 'utf8');
    const apiBase = config.API_URL.replace(/[&<>"']/g, character => attributeEntities[character]);
    res.set('Cache-Control', 'no-store');
    res.type('html').send(template.replace('__LOGIN_API_BASE__', () => apiBase));
  } catch (error) {
    next(error);
  }
});

router.get('/login/assets/:asset', (req, res, next) => {
  if (!['login.css', 'login.js', 'investment-charts.png'].includes(req.params.asset)) return next();
  res.sendFile(req.params.asset, { root: assetsDirectory }, error => {
    if (error) next(error);
  });
});

export default router;
