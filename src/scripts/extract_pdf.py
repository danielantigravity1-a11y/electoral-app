import pdfplumber
import json
import os

pdf_path = os.path.join(os.path.dirname(__file__), '../../temp/DIVIPOLE 2026.pdf')
json_path = os.path.join(os.path.dirname(__file__), '../../temp/divipole_sucre.json')

# Las paginas en pdfplumber son 0-indexed. Si en el PDF dice pag 200, podria ser la pag 199.
# Vamos a extraer las paginas 195 a 210 y filtrar por codigo de departamento 28.
data = []

print("Abriendo PDF...")
with pdfplumber.open(pdf_path) as pdf:
    # Ajustamos el rango, iteraremos sobre todo el pdf o un rango grande para estar seguros
    for i in range(190, 220):
        if i >= len(pdf.pages):
            break
        page = pdf.pages[i]
        
        # Extraer tabla
        table = page.extract_table()
        if not table:
            continue
        
        for row in table:
            # Check if row has enough columns
            if len(row) < 7:
                continue
            
            # Limpiar datos nulos
            row = [cell.replace('\n', ' ').strip() if cell else '' for cell in row]
            
            # Formato esperado: DEP | MUN | ZON | PUESTO | ...
            # Identificador del departamento Sucre es '28'
            if row[0] == '28':
                data.append({
                    'cod_municipio': row[1],
                    'nombre_municipio': row[2], # Asumiendo columna 2 es nombre mun
                    'zona': row[3],
                    'cod_puesto': row[4],
                    'nombre_puesto': row[5], # Asumiendo columna 5 es nombre puesto
                    # Puedes ajustar los indices si estan en otro orden
                    'raw': row
                })

print(f"Extrayendo datos de {len(data)} puestos en Sucre...")

if data:
    # Guardamos el primer registro para inspeccionar si mapeamos bien las columnas
    print("Muestra de datos:")
    print(json.dumps(data[0], indent=2))
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Guardado en divipole_sucre.json")
else:
    print("No se encontraron datos para el departamento 28 en ese rango de paginas.")
