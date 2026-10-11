import * as AuthService from '../services/auth.service.js';

export const login = async (req, res, next) => {
  try {
    const result = await AuthService.loginUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getSession = async (req, res, next) => {
  try {
    res.status(200).json({
      user: req.user || { role: 'ANONYMOUS' },
      activeDatabase: req.dbTarget,
      status: 'AUTHENTICATED',
    });
  } catch (error) {
    next(error);
  }
};

