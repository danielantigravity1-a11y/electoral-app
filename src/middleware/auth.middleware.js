const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Acceso denegado. Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_jwt_key_2026_sucre_electoral');
    
    req.user = decoded; // Guardamos el payload del usuario en req.user
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
  }
};

const roleMiddleware = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos suficientes para realizar esta acción.' });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  roleMiddleware
};
