const bcrypt = require('bcryptjs');

const contrasena = process.argv[2];

if (!contrasena) {
  console.log('Uso: node generar_hash_admin.js TuContrasenaAqui');
  process.exit(1);
}

bcrypt.hash(contrasena, 10).then((hash) => {
  console.log('');
  console.log('Contraseña:', contrasena);
  console.log('Hash:      ', hash);
  console.log('');
});