const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const files = ['dashboard.html', 'asignacion.html', 'comision.html', 'alertas.html', 'juridico.html', 'usuarios.html'];

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace literal '\n' string with actual newline character '\n'
    content = content.replace(/\\n/g, '\n');
    
    fs.writeFileSync(filePath, content);
    console.log('Fixed ' + file);
});
